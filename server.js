import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

app.post('/clip', async (req, res) => {
  const { video_url, start, end, title } = req.body;
  if (!video_url || !start || !end || !title) {
    return res.status(400).send({ error: 'Missing fields' });
  }

  const inputPath = `/tmp/${uuidv4()}_input.mp4`;
  const outputPath = `/tmp/${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;

  try {
    const response = await axios({ url: video_url, responseType: 'stream' });
    const writer = fs.createWriteStream(inputPath);
    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const cmd = `ffmpeg -y -i ${inputPath} -ss ${start} -to ${end} -c copy ${outputPath}`;
    console.log(`Running: ${cmd}`);
    await new Promise((resolve, reject) => {
      exec(cmd, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const clip = fs.readFileSync(outputPath);
    res.send({
      filename: outputPath.split('/').pop(),
      file: clip.toString('base64'),
    });

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Clipping failed', details: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('🎬 FFmpeg server ready');
});