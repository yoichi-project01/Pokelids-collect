import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '1h';
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? '30');

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString('hex');
  const hash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHmac('sha256', REFRESH_SECRET).update(token).digest('hex');
}
