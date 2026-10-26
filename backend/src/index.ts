import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 5000);
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI is required. Copy .env.example to .env and configure MongoDB Atlas.');
  process.exit(1);
}

async function start() {
  try {
    await mongoose.connect(mongoUri!);
    createApp().listen(port, () => console.log(`GoPratle API listening on port ${port}`));
  } catch (error) {
    console.error('Unable to connect to MongoDB.', error);
    process.exit(1);
  }
}

void start();
