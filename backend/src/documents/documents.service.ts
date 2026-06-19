import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { R2Service } from '../storage/r2.service';
import { ScanService } from '../storage/scan.service';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
};

interface UploadMeta {
  projectId?: number;
  taskId?: number;
  title?: string;
  description?: string;
}
interface UpdateMeta {
  title?: string;
  description?: string;
}
export interface DocDoc {
  id: number;
  projectId?: number | null;
  taskId?: number | null;
  uploadedBy: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  version: number;
  title?: string | null;
  description?: string | null;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly fs: FirestoreService,
    private readonly r2: R2Service,
    private readonly scan: ScanService,
  ) {}

  async findAll(filters: { projectId?: number; taskId?: number } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.projectId != null) where.projectId = filters.projectId;
    if (filters.taskId != null) where.taskId = filters.taskId;
    const docs = await this.fs.findMany<DocDoc>(COL.documents, { where });
    docs.sort((a, b) => b.id - a.id);

    const uIds = [...new Set(docs.map((d) => d.uploadedBy).filter((x) => x != null))];
    const pIds = [...new Set(docs.map((d) => d.projectId).filter((x): x is number => x != null))];
    const uMap = new Map<number, any>();
    await Promise.all(uIds.map(async (id) => {
      const u = await this.fs.findById<any>(COL.users, id);
      if (u) uMap.set(id, { id: u.id, firstName: u.firstName, lastName: u.lastName });
    }));
    const pMap = new Map<number, any>();
    await Promise.all(pIds.map(async (id) => {
      const p = await this.fs.findById<any>(COL.projects, id);
      if (p) pMap.set(id, { id: p.id, title: p.title });
    }));
    return docs.map((d) => ({
      ...d,
      uploader: uMap.get(d.uploadedBy) ?? null,
      project: d.projectId != null ? pMap.get(d.projectId) ?? null : null,
    }));
  }

  private async latestVersion(fileName: string): Promise<number> {
    const all = await this.fs.findMany<DocDoc>(COL.documents, { where: { fileName } });
    return all.reduce((max, d) => Math.max(max, d.version ?? 0), 0);
  }

  async upload(file: Express.Multer.File, meta: UploadMeta, userId: number) {
    if (!file) throw new BadRequestException('No file provided.');
    if (!ALLOWED[file.mimetype])
      throw new BadRequestException(
        'Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPG, ZIP.',
      );
    if (file.size > MAX_SIZE)
      throw new BadRequestException('File exceeds the 25MB limit.');

    const result = await this.scan.scan(file.buffer, file.originalname);
    if (!result.clean)
      throw new BadRequestException(
        `File rejected by virus scan${result.reason ? `: ${result.reason}` : '.'}`,
      );

    const version = (await this.latestVersion(file.originalname)) + 1;
    const key = `documents/${Date.now()}-v${version}-${file.originalname}`;
    const fileUrl = await this.r2.upload(key, file.buffer, file.mimetype);

    return this.fs.create<DocDoc>(COL.documents, {
      projectId: meta.projectId ?? null,
      taskId: meta.taskId ?? null,
      uploadedBy: userId,
      fileName: file.originalname,
      fileUrl,
      fileType: ALLOWED[file.mimetype],
      fileSize: file.size,
      version,
      title: meta.title ?? null,
      description: meta.description ?? null,
    });
  }

  async update(id: number, meta: UpdateMeta) {
    const doc = await this.fs.findById(COL.documents, id);
    if (!doc) throw new NotFoundException('Document not found.');
    const data: Record<string, unknown> = {};
    if (meta.title !== undefined) data.title = meta.title;
    if (meta.description !== undefined) data.description = meta.description;
    return this.fs.update(COL.documents, id, data);
  }

  async remove(id: number) {
    const doc = await this.fs.findById(COL.documents, id);
    if (!doc) throw new NotFoundException('Document not found.');
    await this.fs.delete(COL.documents, id);
    return { ok: true };
  }

  async listVersions(id: number) {
    const doc = await this.fs.findById<DocDoc>(COL.documents, id);
    if (!doc) throw new NotFoundException('Document not found.');
    const versions = await this.fs.findMany<DocDoc>(COL.documents, {
      where: { fileName: doc.fileName },
    });
    versions.sort((a, b) => b.version - a.version);
    return versions;
  }

  // Rollback = create a new version pointing at an older version's stored file.
  async rollback(id: number, versionId: number, userId: number) {
    const doc = await this.fs.findById<DocDoc>(COL.documents, id);
    if (!doc) throw new NotFoundException('Document not found.');
    const target = await this.fs.findById<DocDoc>(COL.documents, versionId);
    if (!target || target.fileName !== doc.fileName)
      throw new NotFoundException('Target version not found for this file.');

    const version = (await this.latestVersion(doc.fileName)) + 1;
    return this.fs.create<DocDoc>(COL.documents, {
      projectId: target.projectId ?? null,
      taskId: target.taskId ?? null,
      uploadedBy: userId,
      fileName: target.fileName,
      fileUrl: target.fileUrl,
      fileType: target.fileType,
      fileSize: target.fileSize,
      version,
      title: null,
      description: null,
    });
  }
}
