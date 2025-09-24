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
    origin: "http://localhost:5173",
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
const mongoClient = new MongoClient(MONGO_URI);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

let usersColl, docsColl, chunksColl, historyColl;

async function initDb() {
  await mongoClient.connect();
  const db = mongoClient.db(MONGO_DB);
  usersColl = db.collection("users");
  docsColl = db.collection("documents");
  chunksColl = db.collection("chunks");
  historyColl = db.collection("history");
  console.log("✅ Connected to MongoDB");
}
initDb().catch((err) => {
  console.error("DB init failed:", err);
  process.exit(1);
});

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

// --- Google OAuth ---
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
        const newUser = {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value || "",
          createdAt: new Date(),
        };
        const res = await usersColl.insertOne(newUser);
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
    failureRedirect: "/login",
    session: false,
  }),
  (req, res) => {
    const token = generateJwt(req.user);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // set true in production
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect("http://localhost:5173/");
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

// --- Upload ---
app.post(
  "/api/upload",
  verifyTokenMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const { buffer, originalname, mimetype } = req.file;
      const { Key, publicUrl } = await uploadToS3(
        buffer,
        originalname,
        mimetype
      );

      const fullText = await extractTextFromBuffer(
        buffer,
        mimetype,
        originalname
      );
      const chunks = fullText.match(/.{1,1000}/g) || [];

      const docRes = await docsColl.insertOne({
        userId: req.user._id,
        filename: originalname,
        s3Key: Key,
        s3Url: publicUrl,
        uploadedAt: new Date(),
        textLength: fullText.length,
        chunkCount: chunks.length,
      });
      const docId = docRes.insertedId;

      if (chunks.length > 0) {
        const embResp = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunks,
        });
        const bulk = embResp.data.map((d, i) => ({
          docId,
          chunkIndex: i,
          text: chunks[i],
          embedding: d.embedding,
          createdAt: new Date(),
        }));
        await chunksColl.insertMany(bulk);
      }

      res.json({
        ok: true,
        docId: docId.toString(),
        s3Url: publicUrl,
        chunkCount: chunks.length,
      });
    } catch (err) {
      console.error("Upload error", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// --- Ask ---
app.post("/api/ask", verifyTokenMiddleware, async (req, res) => {
  try {
    const { docId, question, topK = 5 } = req.body;
    const qEmbResp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const qEmbedding = qEmbResp.data[0].embedding;

    const chunks = await chunksColl
      .find({ docId: new ObjectId(docId) })
      .toArray();
    const scored = chunks.map((c) => ({
      ...c,
      score: c.embedding.reduce((acc, v, i) => acc + v * qEmbedding[i], 0),
    }));
    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topK);

    const context = topChunks.map((c) => c.text).join("\n\n");

    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        { role: "system", content: "Answer using the provided context." },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 500,
    });

    const answer = completion.choices[0].message.content;
    await historyColl.insertOne({
      userId: req.user._id,
      docId: new ObjectId(docId),
      question,
      answer,
      createdAt: new Date(),
    });
    res.json({ answer, sources: topChunks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MyDocs & History ---
app.get("/api/my-docs", verifyTokenMiddleware, async (req, res) => {
  const docs = await docsColl
    .find({ userId: req.user._id })
    .sort({ uploadedAt: -1 })
    .toArray();
  res.json({ docs });
});

// Get chat history for a specific document
app.get("/api/history/:docId", verifyTokenMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const h = await historyColl
      .find({ userId: req.user._id, docId: new ObjectId(docId) })
      .sort({ createdAt: -1 }) // newest first
      .toArray();
    res.json({ history: h });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
