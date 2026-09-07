/**
 * Tests for the S3 service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createS3Service } from '../s3/client'
import type { S3Config } from '../types'
import type { S3Operations, ObjectMetadata } from '../s3/types'

describe('S3 Service', () => {
  const mockConfig: S3Config = {
    region: 'eu-west-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
    publicBaseUrl: 'https://cdn.example.com',
  }

  let mockClient: S3Operations

  beforeEach(() => {
    mockClient = {
      putObject: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com'),
      headObject: vi.fn().mockResolvedValue({
        size: 1024,
        contentType: 'image/jpeg',
        lastModified: new Date(),
      } as ObjectMetadata),
    }
  })

  describe('upload', () => {
    it('uploads a file that passes MIME validation', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.from('test image data')

      const result = await service.upload(file, {
        folder: 'products',
        contentType: 'image/jpeg',
      })

      expect(result).toMatchObject({
        url: expect.stringContaining('https://cdn.example.com/products/'),
        size: file.length,
      })
      expect(result.key).toMatch(/^products\/[\w-]+\.jpg$/)
      expect(mockClient.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          key: result.key,
          body: file,
          contentType: 'image/jpeg',
        })
      )
    })

    it('uploads with a custom filename', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.from('test')

      const result = await service.upload(file, {
        folder: 'products',
        contentType: 'image/png',
        filename: 'custom-product',
      })

      expect(result.key).toBe('products/custom-product.png')
    })

    it('rejects a file that is too large', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.alloc(11 * 1024 * 1024) // 11MB (> 10MB limit)

      await expect(
        service.upload(file, {
          folder: 'products',
          contentType: 'image/jpeg',
        })
      ).rejects.toThrow('Fichier trop volumineux')
    })

    it('rejects a MIME type that is not allowed', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.from('test')

      await expect(
        service.upload(file, {
          folder: 'products',
          contentType: 'application/pdf',
        })
      ).rejects.toThrow('Type MIME non autorisé')
    })

    it('accepts PDFs in the cms folder', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.from('test pdf')

      const result = await service.upload(file, {
        folder: 'cms',
        contentType: 'application/pdf',
      })

      expect(result.key).toMatch(/^cms\/[\w-]+\.pdf$/)
    })

    it('respects a custom maxSize', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.alloc(6 * 1024 * 1024) // 6MB

      await expect(
        service.upload(file, {
          folder: 'products',
          contentType: 'image/jpeg',
          maxSize: 5 * 1024 * 1024, // 5MB limit
        })
      ).rejects.toThrow('Fichier trop volumineux')
    })

    it('uploads with custom metadata', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.from('test')

      await service.upload(file, {
        folder: 'products',
        contentType: 'image/jpeg',
        metadata: { productId: '123', category: 'food' },
      })

      expect(mockClient.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { productId: '123', category: 'food' },
        })
      )
    })
  })

  describe('getPresignedUploadUrl', () => {
    it('generates a presigned URL for upload', async () => {
      const service = createS3Service(mockConfig, mockClient)

      const result = await service.getPresignedUploadUrl({
        folder: 'products',
        contentType: 'image/jpeg',
      })

      expect(result).toMatchObject({
        uploadUrl: 'https://signed-url.example.com',
        expiresAt: expect.any(Date),
      })
      expect(result.key).toMatch(/^products\/[\w-]+\.jpg$/)
      expect(mockClient.getSignedUrl).toHaveBeenCalledWith({
        key: result.key,
        expiresIn: 15 * 60, // 15 minutes
        operation: 'putObject',
      })
    })

    it('rejects a MIME type that is not allowed', async () => {
      const service = createS3Service(mockConfig, mockClient)

      await expect(
        service.getPresignedUploadUrl({
          folder: 'products',
          contentType: 'video/mp4',
        })
      ).rejects.toThrow('Type MIME non autorisé')
    })
  })

  describe('getPresignedDownloadUrl', () => {
    it('generates a presigned URL for download', async () => {
      const service = createS3Service(mockConfig, mockClient)

      const result = await service.getPresignedDownloadUrl(
        'products/test.jpg',
        7200
      )

      expect(result).toMatchObject({
        downloadUrl: 'https://signed-url.example.com',
        expiresAt: expect.any(Date),
      })
      expect(mockClient.getSignedUrl).toHaveBeenCalledWith({
        key: 'products/test.jpg',
        expiresIn: 7200,
        operation: 'getObject',
      })
    })

    it('defaults to 3600s', async () => {
      const service = createS3Service(mockConfig, mockClient)

      await service.getPresignedDownloadUrl('products/test.jpg')

      expect(mockClient.getSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresIn: 3600,
        })
      )
    })
  })

  /**
   * `setup-aws.sh` turns bucket versioning ON, and on a versioned bucket a
   * plain `DeleteObject` deletes NOTHING: it writes a delete marker and retains
   * every prior version, billable and readable by anyone who can name a version
   * id. The media library said « définitivement supprimé » and kept every byte,
   * so an RGPD erasure request was answered falsely.
   *
   * These assert the fix at the only place it can be asserted without a bucket:
   * which calls leave the service, and what it reports having done.
   */
  describe('delete', () => {
    /** Two prior versions and the delete marker written over them. */
    const VERSIONS = [
      { key: 'products/test.jpg', versionId: 'v3', isDeleteMarker: true },
      { key: 'products/test.jpg', versionId: 'v2', isDeleteMarker: false },
      { key: 'products/test.jpg', versionId: 'v1', isDeleteMarker: false },
    ]

    /** An adapter whose IAM policy carries the version permissions. */
    function versionAware(versions = VERSIONS): S3Operations {
      return {
        ...mockClient,
        listObjectVersions: vi.fn().mockResolvedValue({ versions }),
        deleteObjectVersion: vi.fn().mockResolvedValue(undefined),
      }
    }

    it('removes every version and the delete marker, by id', async () => {
      const client = versionAware()
      const service = createS3Service(mockConfig, client)

      const result = await service.delete('products/test.jpg')

      expect(result).toEqual({ outcome: 'purged', versionsDeleted: 3 })
      for (const versionId of ['v1', 'v2', 'v3']) {
        expect(client.deleteObjectVersion).toHaveBeenCalledWith({
          key: 'products/test.jpg',
          versionId,
        })
      }
    })

    it('does not touch a neighbour whose key merely starts the same', async () => {
      // The S3 API is prefix-based and `products/test.jpg` is a prefix of
      // `products/test.jpg.bak`. Purging by prefix would delete a file nobody
      // asked to delete.
      const client = versionAware([
        ...VERSIONS,
        { key: 'products/test.jpg.bak', versionId: 'bak1', isDeleteMarker: false },
      ])
      const service = createS3Service(mockConfig, client)

      const result = await service.delete('products/test.jpg')

      expect(result.versionsDeleted).toBe(3)
      expect(client.deleteObjectVersion).not.toHaveBeenCalledWith(
        expect.objectContaining({ versionId: 'bak1' })
      )
    })

    it('walks a truncated listing to the end', async () => {
      const listObjectVersions = vi
        .fn()
        .mockResolvedValueOnce({
          versions: [VERSIONS[0]],
          nextKeyMarker: 'products/test.jpg',
          nextVersionIdMarker: 'v3',
        })
        .mockResolvedValueOnce({ versions: [VERSIONS[1], VERSIONS[2]] })
      const client: S3Operations = {
        ...mockClient,
        listObjectVersions,
        deleteObjectVersion: vi.fn().mockResolvedValue(undefined),
      }
      const service = createS3Service(mockConfig, client)

      const result = await service.delete('products/test.jpg')

      expect(result.versionsDeleted).toBe(3)
      expect(listObjectVersions).toHaveBeenNthCalledWith(2, {
        prefix: 'products/test.jpg',
        keyMarker: 'products/test.jpg',
        versionIdMarker: 'v3',
      })
    })

    it('reports a delete marker rather than pretending, when the adapter cannot purge', async () => {
      // Every client provisioned before `s3:DeleteObjectVersion` was added to
      // the IAM policy is in this state. Throwing here would break them; saying
      // nothing would repeat the original lie.
      const service = createS3Service(mockConfig, mockClient)

      const result = await service.delete('products/test.jpg')

      expect(result).toEqual({
        outcome: 'delete-marker',
        versionsDeleted: 0,
        reason: 'unsupported-adapter',
      })
      expect(mockClient.deleteObject).toHaveBeenCalledWith({
        key: 'products/test.jpg',
      })
    })

    it('falls back, and says why, when the listing is refused', async () => {
      const client: S3Operations = {
        ...mockClient,
        listObjectVersions: vi.fn().mockRejectedValue(new Error('AccessDenied')),
        deleteObjectVersion: vi.fn().mockResolvedValue(undefined),
      }
      const service = createS3Service(mockConfig, client)

      const result = await service.delete('products/test.jpg')

      // A delete that throws leaves the row deleted and the object present with
      // nobody told, which is strictly worse than a marker plus an honest
      // outcome.
      expect(result).toEqual({
        outcome: 'delete-marker',
        versionsDeleted: 0,
        reason: 'listing-refused',
      })
      expect(client.deleteObject).toHaveBeenCalled()
    })

    it('still issues the plain delete after a purge', async () => {
      // Between the listing and the last version delete another writer may have
      // added a version, and on an unversioned bucket the listing comes back
      // empty while the object exists.
      const client = versionAware([])
      const service = createS3Service(mockConfig, client)

      const result = await service.delete('products/test.jpg')

      expect(result).toEqual({ outcome: 'purged', versionsDeleted: 0 })
      expect(client.deleteObject).toHaveBeenCalledWith({ key: 'products/test.jpg' })
    })

    it('rejects an empty key', async () => {
      const service = createS3Service(mockConfig, mockClient)

      await expect(service.delete('')).rejects.toThrow()
    })
  })

  describe('getPublicUrl', () => {
    it('returns the URL built from publicBaseUrl', async () => {
      const service = createS3Service(mockConfig, mockClient)

      const url = service.getPublicUrl('products/test.jpg')

      expect(url).toBe('https://cdn.example.com/products/test.jpg')
    })

    it('falls back to the in-app proxy when no CDN fronts the bucket', async () => {
      // Never the direct S3 endpoint: the bucket grants no anonymous read.
      const configWithoutCDN = { ...mockConfig, publicBaseUrl: undefined }
      const service = createS3Service(configWithoutCDN, mockClient)

      const url = service.getPublicUrl('products/test.jpg')

      expect(url).toBe('/api/files/products/test.jpg')
      expect(url).not.toContain('amazonaws.com')
    })
  })

  describe('exists', () => {
    it('returns true when the file exists', async () => {
      const service = createS3Service(mockConfig, mockClient)

      const exists = await service.exists('products/test.jpg')

      expect(exists).toBe(true)
      expect(mockClient.headObject).toHaveBeenCalledWith({
        key: 'products/test.jpg',
      })
    })

    it('returns false when the file does not exist', async () => {
      mockClient.headObject = vi.fn().mockRejectedValue(new Error('Not found'))
      const service = createS3Service(mockConfig, mockClient)

      const exists = await service.exists('products/missing.jpg')

      expect(exists).toBe(false)
    })
  })

  describe('getMetadata', () => {
    it('returns the file metadata', async () => {
      const service = createS3Service(mockConfig, mockClient)

      const metadata = await service.getMetadata('products/test.jpg')

      expect(metadata).toMatchObject({
        size: 1024,
        contentType: 'image/jpeg',
        lastModified: expect.any(Date),
      })
      expect(mockClient.headObject).toHaveBeenCalledWith({
        key: 'products/test.jpg',
      })
    })
  })
})
