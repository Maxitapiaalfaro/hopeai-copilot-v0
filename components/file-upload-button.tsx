"use client"

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, Upload, X, FileText, ImageIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClinicalFile } from '@/types/clinical-types'

interface FileUploadButtonProps {
  onFilesSelected: (files: ClinicalFile[]) => void
  uploadDocument: (file: File) => Promise<ClinicalFile>
  disabled?: boolean
  pendingFiles?: ClinicalFile[]
  onRemoveFile?: (fileId: string) => void
}

export function FileUploadButton({ 
  onFilesSelected, 
  uploadDocument, 
  disabled = false,
  pendingFiles = [],
  onRemoveFile
}: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadError(null)
    
    try {
      const uploadedFiles: ClinicalFile[] = []
      
      for (const file of Array.from(files)) {
        try {
          const uploadedFile = await uploadDocument(file)
          uploadedFiles.push(uploadedFile)
        } catch (error) {
          console.error('Error uploading file:', file.name, error)
          setUploadError(`Error subiendo ${file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
        }
      }
      
      if (uploadedFiles.length > 0) {
        onFilesSelected(uploadedFiles)
      }
    } finally {
      setIsUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon
    return FileText
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleButtonClick}
        disabled={disabled || isUploading}
        className={cn(
          "h-8 w-8 p-0",
          pendingFiles.length > 0 && "text-blue-600"
        )}
      >
        {isUploading ? (
          <Upload className="h-4 w-4 animate-pulse" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </Button>
      
      {/* Pending Files Indicator */}
      {pendingFiles.length > 0 && (
        <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {pendingFiles.length}
        </div>
      )}
      
      {/* Pending Files List */}
      {pendingFiles.length > 0 && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
          <div className="text-xs font-medium text-gray-700 mb-2">
            Archivos listos para enviar:
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {pendingFiles.map((file) => {
              const FileIcon = getFileIcon(file.type)
              return (
                <div key={file.id} className="flex items-center gap-2 text-xs">
                  <FileIcon className="h-3 w-3 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{file.name}</div>
                    <div className="text-gray-500">{formatFileSize(file.size)}</div>
                  </div>
                  {onRemoveFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFile(file.id)}
                      className="h-4 w-4 p-0 hover:bg-red-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Upload Error */}
      {uploadError && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-red-50 border border-red-200 rounded-lg p-2 z-10">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">{uploadError}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUploadError(null)}
              className="h-4 w-4 p-0 ml-auto"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}