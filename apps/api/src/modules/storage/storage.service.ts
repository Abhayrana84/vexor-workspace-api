import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.AWS_S3_BUCKET || 'vexor-uploads';
    
    // Initialize S3 client only if credentials are provided, else fallback to null
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        endpoint: process.env.AWS_S3_ENDPOINT || undefined,
        forcePathStyle: !!process.env.AWS_S3_ENDPOINT,
      });
    }
  }

  /**
   * Generates a signed PUT URL for clients to upload binary files directly to object storage
   */
  async getPresignedUploadUrl(orgId: string, filename: string, contentType: string) {
    const key = `tenants/${orgId}/${Date.now()}-${filename}`;

    if (!this.s3Client) {
      // In development / local environment without AWS keys, return a local mock upload path
      return {
        uploadUrl: `http://localhost:4000/api/storage/local-upload-sim?key=${key}`,
        fileUrl: `http://localhost:4000/api/storage/files/${key}`,
        key,
      };
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      const fileUrl = process.env.AWS_S3_CUSTOM_DOMAIN 
        ? `${process.env.AWS_S3_CUSTOM_DOMAIN}/${key}`
        : `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      return {
        uploadUrl,
        fileUrl,
        key,
      };
    } catch (err: any) {
      throw new InternalServerErrorException(`Failed to generate S3 upload signature: ${err.message}`);
    }
  }
}
