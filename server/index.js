// --- Load env ---
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { MongoClient, ObjectId } = require("mongodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const jwt = require("jsonwebtoken");
const OpenAI = require("openai");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();

// --- Middleware ---
app.use(
  cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.JWT_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

const upload = multer({ storage: multer.memoryStorage() });

// --- ENV ---
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "docqna";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o";
const USE_MONGO_VECTOR_SEARCH = process.env.USE_MONGO_VECTOR_SEARCH === "true";

const AWS_REGION = process.env.AWS_REGION;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const JWT_SECRET = process.env.JWT_SECRET || "jwt-secret";

// --- Clients ---
const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
const mongoClient = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 20000, // wait longer before failing
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- Globals ---
let usersColl, docsColl, chunksColl, historyColl;

// --- Helpers ---
function generateJwt(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

async function verifyTokenMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await usersColl.findOne({ _id: new ObjectId(payload.id) });
    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function uploadToS3(buffer, filename, contentType) {
  const Key = `${Date.now()}_${filename.replace(/\s+/g, "_")}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  const publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${Key}`;
  return { Key, publicUrl };
}

async function extractTextFromBuffer(buffer, mimetype, originalname) {
  const lower = (originalname || "").toLowerCase();
  if (mimetype === "application/pdf" || lower.endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    return data.text || "";
  }
  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }
  return buffer.toString("utf-8");
}

// --- Start function (DB first, then Passport, then Server) ---
async function startServer() {
  try {
    // ✅ Connect DB first
    await mongoClient.connect();
    const db = mongoClient.db(MONGO_DB);
    usersColl = db.collection("users");
    docsColl = db.collection("documents");
    chunksColl = db.collection("chunks");
    historyColl = db.collection("history");
    console.log("✅ Connected to MongoDB");

    // ✅ Google OAuth setup AFTER DB is ready
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL:
            process.env.GOOGLE_CALLBACK_URL ||
            "http://localhost:5001/api/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          let user = await usersColl.findOne({ googleId: profile.id });
          if (!user) {
            const res = await usersColl.insertOne({
              googleId: profile.id,
              name: profile.displayName,
              email: profile.emails?.[0]?.value || "",
              createdAt: new Date(),
            });
            user = await usersColl.findOne({ _id: res.insertedId });
          }
          return done(null, user);
        }
      )
    );

    passport.serializeUser((user, done) => done(null, user._id));
    passport.deserializeUser(async (id, done) => {
      const user = await usersColl.findOne({ _id: new ObjectId(id) });
      done(null, user);
    });

    // --- Auth Routes ---
    app.get(
      "/api/auth/google",
      passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
      })
    );

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", {
        // failureRedirect: "/login",
        failureRedirect: `${process.env.FRONTEND_URL}/login`,
        session: false,
      }),
      (req, res) => {
        const token = generateJwt(req.user);
        res.cookie("token", token, {
          httpOnly: true,
          // sameSite: "lax",
          sameSite: "none",
          // secure: false, // true in production HTTPS
          secure: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // ✅ Redirect to env FRONTEND_URL
        res.redirect(process.env.FRONTEND_URL || "http://localhost:5173/");
      }
    );

    app.get("/api/auth/me", verifyTokenMiddleware, async (req, res) => {
      res.json({
        user: { id: req.user._id, email: req.user.email, name: req.user.name },
      });
    });

    app.post("/api/auth/logout", (req, res) => {
      res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
      res.json({ ok: true });
    });

    // ✅ Start server only after everything is ready
    app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
}

startServer();
