import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { unlink } from 'fs/promises';
import type { CreatePositionRequest, UpdatePositionRequest } from '@openats/types';
import Position from '../models/Position.js';
import Match from '../models/Match.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Only PDF or DOCX files allowed'));
  cb(null, true);
}});

// POST /positions
router.post('/', async (req: Request<{}, unknown, CreatePositionRequest>, res: Response) => {
  try {
    const position = await Position.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json(position);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /positions
router.get('/', async (req: Request, res: Response) => {
  try {
    const positions = await Position.find({ tenantId: req.tenantId });
    res.json(positions);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /positions/:id
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const position = await Position.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });
    res.json(position);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// PUT /positions/:id
router.put('/:id', async (req: Request<{ id: string }, unknown, UpdatePositionRequest>, res: Response) => {
  try {
    const position = await Position.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });

    const { title, jobDescription, selectionProcessId } = req.body;

    if (title !== undefined) position.title = title;
    if (jobDescription !== undefined) position.jobDescription = jobDescription;
    if (selectionProcessId !== undefined) position.selectionProcessId = selectionProcessId;

    await position.save();
    res.json(position);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE /positions/:id — also clears its rankings
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const position = await Position.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });
    await Match.deleteMany({ positionId: req.params.id, tenantId: req.tenantId });
    res.json({ deleted: true });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /positions/:id/upload — multipart PDF/DOCX upload of the job description file
router.post('/:id/upload', upload.single('jobDescriptionFile'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const position = await Position.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });

    // A processed position whose job description file is replaced has stale skills/embeddings.
    if (position.processed) {
      position.skillsStale = true;
    }
    const previousFileUrl = position.jobDescriptionFileUrl;
    position.jobDescriptionFileUrl = req.file.path;
    position.jobDescriptionFileName = req.file.originalname;
    await position.save();

    // Replace the old file on disk so uploads don't accumulate orphaned copies.
    if (previousFileUrl && previousFileUrl !== req.file.path) {
      await unlink(previousFileUrl).catch(() => {});
    }

    res.json({ message: 'Job description uploaded', jobDescriptionFileUrl: req.file.path, position });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /positions/:id/process — stub for LLM extraction + embeddings
router.post('/:id/process', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const position = await Position.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!position) return res.status(404).json({ error: 'Position not found' });
    if (!position.jobDescriptionFileUrl) return res.status(400).json({ error: 'No job description file uploaded yet' });

    // TODO: run OCR/text-extraction on jobDescriptionFileUrl → extractedText
    // TODO: call LLM to extract skills from extractedText
    // TODO: generate embeddings for hardSkillsRequired and softSkillsRequired
    // Stub: mark as processed with empty skills
    position.processed = true;
    position.skillsStale = false;
    await position.save();

    res.json({ message: 'Processing triggered (stub)', position });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /positions/:positionId/ranking
router.get('/:positionId/ranking', async (req: Request<{ positionId: string }>, res: Response) => {
  try {
    const matches = await Match.find({
      positionId: req.params.positionId,
      tenantId: req.tenantId
    })
      .sort({ totalScore: -1 })
      .populate('candidateId', 'name email');
    res.json(matches);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
