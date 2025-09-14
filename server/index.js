require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { MongoClient, ObjectId } = require("mongodb");
const OpenAI = require("openai");

const app = express();

// allow your frontend dev origin and handle preflight
app.use(
  cors({
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// for safety also respond to preflight explicitly (optional)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// --- env ---
const PORT = process.env.PORT || 5000;
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
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!MONGO_URI || !OPENAI_API_KEY) {
  console.error("Please fill MONGO_URI and OPENAI_API_KEY in .env");
  process.exit(1);
}

// --- clients ---
const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const mongoClient = new MongoClient(MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: false,
});

let db, usersColl, docsColl, chunksColl, historyColl;

async function initDb() {
  await mongoClient.connect();
  db = mongoClient.db(MONGO_DB);
  usersColl = db.collection("users");
  docsColl = db.collection("documents");
  chunksColl = db.collection("chunks");
  historyColl = db.collection("history");
  console.log("Connected to MongoDB");
}
initDb().catch((err) => {
  console.error("DB init failed:", err);
  process.exit(1);
});

// ----------------- Helpers -----------------
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
  const signedUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: AWS_S3_BUCKET, Key }),
    { expiresIn: 60 * 60 * 24 * 7 }
  ).catch(() => null);
  const publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${Key}`;
  return { Key, signedUrl: signedUrl || publicUrl, publicUrl };
}

async function extractTextFromBuffer(buffer, mimetype, originalname) {
  const lower = (originalname || "").toLowerCase();
  if (mimetype === "application/pdf" || lower.endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    return data.text || "";
  }
  if (
    lower.endsWith(".docx") ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }
  return buffer.toString("utf-8");
}

function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const slice = text.slice(start, end);
    chunks.push(slice.trim());
    start += chunkSize - overlap;
  }
  return chunks.filter(Boolean);
}

function cosineSim(a, b) {
  let dot = 0.0,
    normA = 0.0,
    normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function generateJwt(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

async function verifyTokenMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  const token = header.split(" ")[1];
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

// ----------------- Auth Routes -----------------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email & password required" });
    const existing = await usersColl.findOne({ email });
    if (existing)
      return res.status(400).json({ error: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    const user = {
      email,
      password: hashed,
      name: name || "",
      createdAt: new Date(),
    };
    const r = await usersColl.insertOne(user);
    const saved = await usersColl.findOne({ _id: r.insertedId });
    const token = generateJwt(saved);
    res.json({
      token,
      user: { id: saved._id, email: saved.email, name: saved.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email & password required" });
    const user = await usersColl.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });
    const token = generateJwt(user);
    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------- Upload route -----------------
app.post(
  "/api/upload",
  verifyTokenMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      const file = req.file;

      // 1) upload to S3
      const { Key, signedUrl, publicUrl } = await uploadToS3(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      // 2) extract text
      const fullText = await extractTextFromBuffer(
        file.buffer,
        file.mimetype,
        file.originalname
      );

      // 3) chunk
      const chunks = chunkText(fullText, 1000, 200);

      // 4) create doc record
      const docRecord = {
        userId: req.user._id,
        filename: file.originalname,
        s3Key: Key,
        s3Url: publicUrl,
        signedUrl,
        uploadedAt: new Date(),
        textLength: fullText.length,
        chunkCount: chunks.length,
      };
      const docRes = await docsColl.insertOne(docRecord);
      const docId = docRes.insertedId;

      // 5) create embeddings (batch)
      if (chunks.length > 0) {
        const embResp = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunks,
        });
        const embeddings = embResp.data.map((d) => d.embedding);

        const bulk = embeddings.map((embedding, idx) => ({
          docId,
          chunkIndex: idx,
          text: chunks[idx],
          embedding,
          createdAt: new Date(),
        }));
        await chunksColl.insertMany(bulk);
      }

      res.json({
        ok: true,
        docId: docId.toString(),
        s3Key: Key,
        s3Url: publicUrl,
        chunkCount: chunks.length,
      });
    } catch (err) {
      console.error("Upload error", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ----------------- ASK route -----------------
// ----------------- ASK route -----------------
app.post("/api/ask", verifyTokenMiddleware, async (req, res) => {
  try {
    const { docId, question, topK = 5 } = req.body;
    if (!docId || !question)
      return res.status(400).json({ error: "docId and question required" });

    // 1) Create embedding for question
    const qEmbResp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const qEmbedding = qEmbResp.data[0].embedding;

    // 2) Retrieve relevant chunks
    let topChunks = [];
    if (USE_MONGO_VECTOR_SEARCH) {
      const pipeline = [
        {
          $search: {
            index: "embeddings_index",
            knnBeta: {
              vector: qEmbedding,
              path: "embedding",
              k: parseInt(topK, 10),
            },
          },
        },
        { $match: { docId: new ObjectId(docId) } },
        {
          $project: {
            text: 1,
            chunkIndex: 1,
            score: { $meta: "searchScore" },
          },
        },
      ];
      const results = await chunksColl.aggregate(pipeline).toArray();
      topChunks = results.map((r) => ({
        chunkIndex: r.chunkIndex,
        text: r.text,
        score: r.score,
      }));
    } else {
      const chunks = await chunksColl
        .find({ docId: new ObjectId(docId) })
        .toArray();
      const scored = chunks.map((c) => ({
        ...c,
        score: cosineSim(qEmbedding, c.embedding),
      }));
      scored.sort((a, b) => b.score - a.score);
      topChunks = scored.slice(0, topK).map((c) => ({
        chunkIndex: c.chunkIndex,
        text: c.text,
        score: c.score,
      }));
    }

    // 3) Build context text
    const contextText = topChunks
      .map(
        (t) =>
          `Chunk ${t.chunkIndex} (score:${(t.score || 0).toFixed(3)}):\n${
            t.text
          }`
      )
      .join("\n\n---\n\n");

    // 4) Call OpenAI with context
    const systemPrompt =
      'You are a helpful assistant. Use the provided document chunks to answer the user\'s question. Cite chunk indices (e.g., "source: chunk 2").';

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Context:\n${contextText}\n\nQuestion: ${question}`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages,
      max_tokens: 800,
    });

    const assistantText =
      completion.choices?.[0]?.message?.content || "No answer";

    // 5) ✅ Save to history
    await historyColl.insertOne({
      userId: req.user._id,
      docId: new ObjectId(docId),
      question,
      answer: assistantText,
      sources: topChunks,
      createdAt: new Date(),
    });

    // 6) Respond
    res.json({ answer: assistantText, sources: topChunks });
  } catch (err) {
    console.error("Ask error", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------- User endpoints -----------------
app.get("/api/my-docs", verifyTokenMiddleware, async (req, res) => {
  try {
    const docs = await docsColl
      .find({ userId: req.user._id })
      .sort({ uploadedAt: -1 })
      .toArray();
    res.json({ docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/history", verifyTokenMiddleware, async (req, res) => {
  try {
    const h = await historyColl
      .find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    res.json({ history: h });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- Health -----------------
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
