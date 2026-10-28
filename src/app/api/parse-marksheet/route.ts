import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let pdfBuffer: Buffer | null = null;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const bytes = await (file as Blob).arrayBuffer();
        pdfBuffer = Buffer.from(bytes);
      }
    } else {
      const bytes = await req.arrayBuffer();
      pdfBuffer = Buffer.from(bytes);
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return NextResponse.json({ error: 'No PDF data received' }, { status: 400 });
    }

    const tempPath = path.join(os.tmpdir(), `marksheet_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    await fs.promises.writeFile(tempPath, pdfBuffer);

    const baseDir = process.cwd();
    const pythonPath = path.join(baseDir, 'venv/bin/python');
    const scriptPath = path.join(baseDir, 'parse_marksheet.py');

    return new Promise<NextResponse>((resolve) => {
      execFile(pythonPath, [scriptPath, tempPath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        fs.unlink(tempPath, () => {});

        if (error) {
          console.error('Python parse error:', error, stderr);
          return resolve(
            NextResponse.json(
              { error: 'Failed to parse marksheet PDF', details: stderr || error.message },
              { status: 500 }
            )
          );
        }

        try {
          const data = JSON.parse(stdout);
          return resolve(NextResponse.json(data));
        } catch {
          return resolve(
            NextResponse.json(
              { error: 'Invalid JSON from parser', raw: stdout },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
