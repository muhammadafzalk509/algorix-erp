import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private client: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucket = this.config.get<string>('R2_BUCKET_NAME') || '';
    this.publicUrl = this.config.get<string>('R2_PUBLIC_URL') || '';

    if (accountId && accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  // Uploads a buffer and returns its public URL. Files are NEVER stored on disk.
  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.client)
      throw new Error(
        'R2 storage is not configured. Set R2_* variables in .env',
      );
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const base = this.publicUrl.replace(/\/$/, '');
    return `${base}/${key}`;
  }
}
