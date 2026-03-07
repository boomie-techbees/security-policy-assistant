import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  FileButton,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Badge,
  Loader,
  Alert,
  Title,
} from '@mantine/core'
import { IconUpload, IconRefresh, IconFileText, IconTrash } from '@tabler/icons-react'
import {
  listUploads,
  listDocuments,
  uploadDocument,
  indexDocument,
  deleteUpload,
  deleteDocument,
  type UploadInfo,
  type DocumentInfo,
} from './api'

export function DocumentLibrary() {
  const [uploads, setUploads] = useState<UploadInfo[]>([])
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [indexing, setIndexing] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setError(null)
    setLoading(true)
    try {
      const [u, d] = await Promise.all([listUploads(), listDocuments()])
      setUploads(u)
      setDocuments(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleUpload = async (file: File | null) => {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      await uploadDocument(file)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleIndex = async (filename: string) => {
    setError(null)
    setIndexing(filename)
    try {
      await indexDocument(filename)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Indexing failed')
    } finally {
      setIndexing(null)
    }
  }

  const handleRemoveFromIndex = async (documentId: string) => {
    setError(null)
    try {
      await deleteDocument(documentId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    }
  }

  const handleDeleteUpload = async (filename: string) => {
    setError(null)
    setDeleting(filename)
    try {
      await deleteUpload(filename)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Box maw={900} mx="auto" py="md">
      <Title order={3} mb="md" c="dark.7">Policy documents</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Upload PDF or DOCX policies. Then index each file so the assistant can use them to answer questionnaire questions. Data is stored locally.
      </Text>

      {error && (
        <Alert color="red" mb="md" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      <Group mb="lg">
        <FileButton
          accept=".pdf,.docx,.doc"
          onChange={handleUpload}
          disabled={uploading}
        >
          {(props) => (
            <Button leftSection={<IconUpload size={16} />} {...props} loading={uploading}>
              Upload document
            </Button>
          )}
        </FileButton>
        <Button variant="subtle" leftSection={<IconRefresh size={16} />} onClick={refresh} loading={loading}>
          Refresh
        </Button>
      </Group>

      {loading ? (
        <Loader />
      ) : (
        <Stack gap="md">
          <Paper p="md" radius="md" withBorder>
            <Text fw={600} size="sm" mb="xs">Uploaded files — Index or Delete per row</Text>
            {uploads.length === 0 ? (
              <Text size="sm" c="dimmed">No files uploaded yet.</Text>
            ) : (
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {uploads.map((u) => (
                    <Table.Tr key={u.filename}>
                      <Table.Td>
                        <Group gap="xs">
                          <IconFileText size={16} />
                          {u.filename}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {u.indexed ? (
                          <Badge color="green" size="sm">Indexed</Badge>
                        ) : (
                          <Badge color="gray" size="sm">Not indexed</Badge>
                        )}
                      </Table.Td>
                      <Table.Td style={{ minWidth: 180 }}>
                        <Group gap="xs" wrap="nowrap">
                          {!u.indexed && (
                            <Button
                              size="xs"
                              variant="light"
                              loading={indexing === u.filename}
                              onClick={() => handleIndex(u.filename)}
                            >
                              Index
                            </Button>
                          )}
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            loading={deleting === u.filename}
                            onClick={() => handleDeleteUpload(u.filename)}
                          >
                            Delete
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          <Paper p="md" radius="md" withBorder>
            <Text fw={600} size="sm" mb="xs">Indexed documents (used for answers)</Text>
            {documents.length === 0 ? (
              <Text size="sm" c="dimmed">No documents in index. Upload and index files above.</Text>
            ) : (
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Document</Table.Th>
                    <Table.Th>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {documents.map((d) => (
                    <Table.Tr key={d.document_id}>
                      <Table.Td>{d.document_name}</Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => handleRemoveFromIndex(d.document_id)}
                        >
                          Remove from index
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Stack>
      )}
    </Box>
  )
}
