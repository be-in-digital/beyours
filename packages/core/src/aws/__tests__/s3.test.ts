/**
 * Tests pour le service S3
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
    it('devrait uploader un fichier avec validation MIME réussie', async () => {
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

    it('devrait uploader avec un nom de fichier personnalisé', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.from('test')

      const result = await service.upload(file, {
        folder: 'products',
        contentType: 'image/png',
        filename: 'custom-product',
      })

      expect(result.key).toBe('products/custom-product.png')
    })

    it('devrait rejeter un fichier trop volumineux', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.alloc(11 * 1024 * 1024) // 11MB (> 10MB limit)

      await expect(
        service.upload(file, {
          folder: 'products',
          contentType: 'image/jpeg',
        })
      ).rejects.toThrow('Fichier trop volumineux')
    })

    it('devrait rejeter un type MIME non autorisé', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.from('test')

      await expect(
        service.upload(file, {
          folder: 'products',
          contentType: 'application/pdf',
        })
      ).rejects.toThrow('Type MIME non autorisé')
    })

    it('devrait accepter les PDFs dans le dossier cms', async () => {
      const service = createS3Service(mockConfig, mockClient)
      const file = Buffer.from('test pdf')

      const result = await service.upload(file, {
        folder: 'cms',
        contentType: 'application/pdf',
      })

      expect(result.key).toMatch(/^cms\/[\w-]+\.pdf$/)
    })

    it('devrait respecter maxSize personnalisé', async () => {
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

    it('devrait uploader avec métadonnées personnalisées', async () => {
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
    it('devrait générer une URL presignée pour upload', async () => {
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

    it('devrait rejeter un type MIME non autorisé', async () => {
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
    it('devrait générer une URL presignée pour téléchargement', async () => {
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

    it('devrait utiliser 3600s par défaut', async () => {
      const service = createS3Service(mockConfig, mockClient)

      await service.getPresignedDownloadUrl('products/test.jpg')

      expect(mockClient.getSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresIn: 3600,
        })
      )
    })
  })

  describe('delete', () => {
    it('devrait supprimer un fichier', async () => {
      const service = createS3Service(mockConfig, mockClient)

      await service.delete('products/test.jpg')

      expect(mockClient.deleteObject).toHaveBeenCalledWith({
        key: 'products/test.jpg',
      })
    })

    it('devrait rejeter une clé vide', async () => {
      const service = createS3Service(mockConfig, mockClient)

      await expect(service.delete('')).rejects.toThrow()
    })
  })

  describe('getPublicUrl', () => {
    it('devrait retourner URL avec publicBaseUrl', async () => {
      const service = createS3Service(mockConfig, mockClient)

      const url = service.getPublicUrl('products/test.jpg')

      expect(url).toBe('https://cdn.example.com/products/test.jpg')
    })

    it('devrait retourner URL S3 par défaut sans publicBaseUrl', async () => {
      const configWithoutCDN = { ...mockConfig, publicBaseUrl: undefined }
      const service = createS3Service(configWithoutCDN, mockClient)

      const url = service.getPublicUrl('products/test.jpg')

      expect(url).toBe(
        'https://test-bucket.s3.eu-west-1.amazonaws.com/products/test.jpg'
      )
    })
  })

  describe('exists', () => {
    it('devrait retourner true si le fichier existe', async () => {
      const service = createS3Service(mockConfig, mockClient)

      const exists = await service.exists('products/test.jpg')

      expect(exists).toBe(true)
      expect(mockClient.headObject).toHaveBeenCalledWith({
        key: 'products/test.jpg',
      })
    })

    it('devrait retourner false si le fichier n\'existe pas', async () => {
      mockClient.headObject = vi.fn().mockRejectedValue(new Error('Not found'))
      const service = createS3Service(mockConfig, mockClient)

      const exists = await service.exists('products/missing.jpg')

      expect(exists).toBe(false)
    })
  })

  describe('getMetadata', () => {
    it('devrait retourner les métadonnées du fichier', async () => {
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
