import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { authRouter } from './routes/auth';
import { pokeLidsRouter } from './routes/pokeLids';
import { collectionsRouter } from './routes/collections';
import { photosRouter } from './routes/photos';
import { progressRouter } from './routes/progress';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/poke-lids', pokeLidsRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/progress', progressRouter);

const webBuildDir = path.join(__dirname, '..', 'public');
app.use(express.static(webBuildDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(webBuildDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
