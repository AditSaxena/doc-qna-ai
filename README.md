# 📈 Document QnA AI (MERN + OpenAI + MongoDB Atlas + AWS S3)

An AI-powered web app where users can **upload documents** (PDF/DOCX/TXT), and then **ask questions** about the content. The app uses **OpenAI embeddings + Chat models** to answer questions based on the uploaded document, with support for **file storage on AWS S3**, **vector search in MongoDB Atlas**, and a clean **React (Vite) frontend**.

---

## 🚀 Features

- 🔐 **User Authentication** (Register/Login with JWT)
- 📄 **Upload Documents** (PDF, DOCX, TXT)
- ☁️ **AWS S3 Integration** — secure file storage
- 🧩 **Text Extraction + Chunking**
- 🧠 **Embeddings with OpenAI**
- 🔎 **Vector Search** (MongoDB Atlas) with fallback to cosine similarity
- 💬 **Chat with Your Documents** (QnA with citations)
- 📜 **History Page** — view past questions and answers
- 📂 **My Docs Page** — view all uploaded documents

---

## 🛠️ Tech Stack

**Frontend**: React (Vite), TailwindCSS
**Backend**: Node.js, Express.js, MongoDB Atlas
**AI/ML**: OpenAI API (Embeddings + GPT-4o for QnA)
**Storage**: AWS S3
**Auth**: JWT (JSON Web Token)

---

## 📂 Project Structure

```
doc-qna-ai/
  ├── client/       # React (Vite) frontend
  ├── server/       # Express backend
  ├── .gitignore
  ├── README.md
```

---

## ⚙️ Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/AditSaxena/doc-qna-ai.git
cd doc-qna-ai
```

### 2. Install dependencies

**Backend**

```bash
cd server
npm install
```

**Frontend**

```bash
cd ../client
npm install
```

### 3. Setup environment variables

Create a `.env` file in `server/` with:

```env
PORT=5001
MONGO_URI=your_mongodb_uri
MONGO_DB=docqna
OPENAI_API_KEY=your_openai_api_key
OPENAI_CHAT_MODEL=gpt-4o
USE_MONGO_VECTOR_SEARCH=false

AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=doc-qna-bucket-123

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
```

### 4. Run the app

**Backend**

```bash
cd server
npx nodemon index.js
```

**Frontend**

```bash
cd client
npm run dev
```

---

## 🌟 Usage

1. Register/Login to your account.
2. Upload a document (PDF/DOCX/TXT).
3. Ask questions in the chat page.
4. View past QnA in the **History Page**.
5. Manage uploaded docs in **My Docs Page**.

---

## 📸 Screenshots (to be added)

- 🔑 Login/Register
- 📄 Upload Page
- 💬 Chat Page with answers & sources
- 📜 History Page

---

## 📦 Deployment

- Backend → Render / Railway / Heroku
- Frontend → Vercel / Netlify
- Database → MongoDB Atlas
- File Storage → AWS S3

---

## 📌 Resume Value

This project demonstrates:

- Full-stack MERN development
- Cloud integrations (MongoDB Atlas, AWS S3)
- Secure authentication (JWT)
- Real AI application (Document QnA with OpenAI)

---

## 📄 License

MIT License © 2025 [Adit Saxena](https://github.com/AditSaxena)
