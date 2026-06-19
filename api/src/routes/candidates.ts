import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { unlink } from 'fs/promises';
import type { CreateCandidateRequest, UpdateCandidateRequest } from '@openats/types';
import Candidate from '../models/Candidate.js';
import Match from '../models/Match.js';
import ProcessingJob from '../models/ProcessingJob.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files allowed'));
  cb(null, true);
}});

// POST /candidates
router.post('/', async (req: Request<{}, unknown, CreateCandidateRequest>, res: Response) => {
  try {
    const candidate = await Candidate.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json(candidate);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /candidates/:id/upload — multipart PDF upload of the resume file
router.post('/:id/upload', upload.single('resume'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const candidate = await Candidate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    // A processed candidate whose resume is replaced has stale skills/embeddings.
    if (candidate.processed) {
      candidate.skillsStale = true;
    }
    const previousFileUrl = candidate.resumePdfUrl;
    candidate.resumePdfUrl = req.file.path;
    candidate.resumeFileName = req.file.originalname;
    await candidate.save();

    // Replace the old file on disk so uploads don't accumulate orphaned copies.
    if (previousFileUrl && previousFileUrl !== req.file.path) {
      await unlink(previousFileUrl).catch(() => {});
    }

    res.json({ message: 'Resume uploaded', resumePdfUrl: req.file.path, candidate });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /candidates/:id/process — enqueue a pending pipeline job (OCR → RAG → embeddings → matching)
router.post('/:id/process', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const candidate = await Candidate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if (!candidate.resumePdfUrl) return res.status(400).json({ error: 'No resume uploaded yet' });

    // Avoid piling up duplicate jobs if Process is clicked while a run is in flight.
    const active = await ProcessingJob.findOne({
      tenantId: req.tenantId,
      entityType: 'candidate',
      entityId: candidate._id,
      status: { $in: ['pending', 'running'] },
    });
    if (active) return res.status(409).json({ error: 'Already queued or processing' });

    // Record a pending job and return immediately; the monitor runs the pipeline
    // and sets processed/skillsStale on completion.
    await ProcessingJob.create({
      tenantId: req.tenantId,
      entityType: 'candidate',
      entityId: candidate._id,
    });

    res.status(202).json({ message: 'Processing queued', candidate });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /candidates
router.get('/', async (req: Request, res: Response) => {
  try {
    const candidates = await Candidate.find({ tenantId: req.tenantId });
    res.json(candidates);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /candidates/:id
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const candidate = await Candidate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// PUT /candidates/:id — name/email only; does not affect resume-derived skills
router.put('/:id', async (req: Request<{ id: string }, unknown, UpdateCandidateRequest>, res: Response) => {
  try {
    const { name, email } = req.body;
    const updates: UpdateCandidateRequest = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    const candidate = await Candidate.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      updates,
      { new: true, runValidators: true }
    );
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE /candidates/:id — also clears its match results
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const candidate = await Candidate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    await candidate.deleteOne();
    if (candidate.resumePdfUrl) await unlink(candidate.resumePdfUrl).catch(() => {});
    await Match.deleteMany({ candidateId: req.params.id, tenantId: req.tenantId });
    res.json({ deleted: true });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /candidates/:candidateId/matches
router.get('/:candidateId/matches', async (req: Request<{ candidateId: string }>, res: Response) => {
  try {
    const matches = await Match.find({
      candidateId: req.params.candidateId,
      tenantId: req.tenantId
    })
      .sort({ totalScore: -1 })
      .populate('positionId', 'title');
    res.json(matches);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
