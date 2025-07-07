const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const serviceAccount = require('./serviceAccount.json');
const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();


const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'serviceAccount.json'), 
  scopes: ['https://www.googleapis.com/auth/drive'],
});

app.post('/upload', upload.single('pdfFile'), async (req, res) => {
  try {
    const { name, email, title } = req.body;
    const file = req.file;

    const driveClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: driveClient });

    // Upload PDF to Drive
    const response = await drive.files.create({
      requestBody: {
        name: file.originalname,
        parents: ['1k5B9ltrTvt93bS8b9A8R285ro4vLfbJh'], 
      },
      media: {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.path),
      },
    });

    const fileId = response.data.id;

    
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
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

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
