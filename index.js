const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const admin = require('firebase-admin');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

app.post('/upload', upload.single('pdfFile'), async (req, res) => {
  try {
    const { name, email, title } = req.body;
    const file = req.file;

    const driveClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: driveClient });

    const response = await drive.files.create({
      requestBody: {
        name: file.originalname,
      },
      media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
    });

    const fileId = response.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const pdfURL = `https://drive.google.com/uc?id=${fileId}`;

    await db.collection('abstracts').add({
      name,
      email,
      title,
      pdfURL,
      submittedAt: new Date(),
    });

    fs.unlinkSync(file.path);

    res.json({ success: true, pdfURL });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
