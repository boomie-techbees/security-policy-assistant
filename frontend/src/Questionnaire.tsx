import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Paper,
  Stack,
  Textarea,
  Text,
  Title,
  Accordion,
  Loader,
  Alert,
  Group,
} from '@mantine/core'
import { IconSend, IconAlertCircle, IconTrash, IconCopy, IconFileTypeDocx, IconBulb } from '@tabler/icons-react'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import { processQuestionnaire, type QuestionnaireItem, type Citation } from './api'

const STORAGE_KEY = 'security-questionnaire-assistant-results'

const COMMON_QUESTIONS = [
  'What is our password policy?',
  'How do we handle data encryption?',
  'What are incident response procedures?',
  'How do we manage access control?',
  'What is our backup and recovery process?',
]

function loadStoredResults(): QuestionnaireItem[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as QuestionnaireItem[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveStoredResults(items: QuestionnaireItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

async function copyAnswerToClipboard(item: QuestionnaireItem) {
  const text = `Question: ${item.question}\n\nAnswer: ${item.answer}`
  await navigator.clipboard.writeText(text)
}

async function exportToWord(items: QuestionnaireItem[]) {
  const children = [
    new Paragraph({
      text: 'Security Questionnaire – Draft Answers',
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 },
    }),
    ...items.flatMap((item, i) => [
      new Paragraph({
        text: `${i + 1}. ${item.question}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      }),
      new Paragraph({
        children: item.answer
          .split(/\n/)
          .flatMap((line, i, arr) => [
            new TextRun({ text: line || ' ' }),
            ...(i < arr.length - 1 ? [new TextRun({ break: 1 })] : []),
          ]),
        spacing: { after: 300 },
      }),
    ]),
  ]
  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, 'security-questionnaire-answers.docx')
}

function CitationBlock({ c }: { c: Citation }) {
  const parts = [c.document_name, c.section_title, c.page_number != null ? `Page ${c.page_number}` : null].filter(Boolean);
  return (
    <Paper p="sm" withBorder radius="sm" mb="xs">
      <Text size="xs" c="dimmed" fw={600}>
        {parts.join(' · ')}
      </Text>
      {c.text && <Text size="sm" mt="xs" style={{ whiteSpace: 'pre-wrap' }}>{c.text}</Text>}
    </Paper>
  )
}

export function Questionnaire() {
  const [questionsText, setQuestionsText] = useState('')
  const [results, setResults] = useState<QuestionnaireItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore persisted Q&A on load (tab switch or refresh)
  useEffect(() => {
    const stored = loadStoredResults()
    if (stored && stored.length > 0) setResults(stored)
  }, [])

  // Persist whenever results change
  useEffect(() => {
    if (results.length > 0) saveStoredResults(results)
  }, [results])

  const handleProcess = async () => {
    const lines = questionsText
      .split(/\n/)
      .map((q) => q.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setError('Enter at least one question (one per line).');
      return;
    }
    setError(null)
    setLoading(true)
    try {
      const data = await processQuestionnaire(lines)
      setResults((prev) => [...prev, ...data])
      setQuestionsText('') // clear input so user can paste next batch
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setResults([])
    setQuestionsText('')
    setError(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  const [copiedId, setCopiedId] = useState<number | null>(null)
  const handleCopy = async (item: QuestionnaireItem, index: number) => {
    await copyAnswerToClipboard(item)
    setCopiedId(index)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const addQuestion = (q: string) => {
    setQuestionsText((prev) => (prev.trim() ? `${prev.trim()}\n${q}` : q))
  }
  const addAllCommonQuestions = () => {
    setQuestionsText((prev) => {
      const current = prev.trim()
      const added = COMMON_QUESTIONS.join('\n')
      return current ? `${current}\n${added}` : added
    })
  }

  return (
    <Box maw={900} mx="auto" py="md">
      <Title order={3} mb="md" c="dark.7">Security questionnaire</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Paste questionnaire questions below (one per line). Answers are generated from your indexed policy documents. Only the question and retrieved excerpts are sent to the AI API.
      </Text>

      {error && (
        <Alert color="red" mb="md" icon={<IconAlertCircle size={16} />} onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      <Paper p="md" radius="md" withBorder mb="lg">
        <Text fw={600} size="sm" mb="xs">Questions</Text>
        <Textarea
          placeholder="Your questions here (one per line). Paste or click suggestions below to add."
          minRows={5}
          value={questionsText}
          onChange={(e) => setQuestionsText(e.currentTarget.value)}
        />
        <Stack gap="xs" mt="md">
          <Group gap="xs">
            <IconBulb size={18} style={{ color: 'var(--mantine-color-yellow-6)' }} />
            <Text size="sm" fw={500}>Common questions:</Text>
          </Group>
          <Text size="xs" c="dimmed">Click any question to add to your list.</Text>
          <Group gap="xs" wrap="wrap">
            {COMMON_QUESTIONS.map((q) => (
              <Button
                key={q}
                variant="light"
                size="xs"
                onClick={() => addQuestion(q)}
                style={{ whiteSpace: 'normal', height: 'auto', padding: '6px 12px' }}
              >
                {q}
              </Button>
            ))}
            <Button variant="subtle" size="xs" onClick={addAllCommonQuestions}>
              Add all
            </Button>
          </Group>
        </Stack>
        <Group mt="md">
          <Button
            leftSection={<IconSend size={16} />}
            onClick={handleProcess}
            loading={loading}
            disabled={!questionsText.trim()}
          >
            Generate draft answers
          </Button>
        </Group>
      </Paper>

      {loading && <Loader />}

      {results.length > 0 && (
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
            <Title order={4}>Draft answers & citations</Title>
            <Group gap="xs">
              <Button
                variant="light"
                size="xs"
                leftSection={<IconFileTypeDocx size={16} />}
                onClick={() => exportToWord(results)}
              >
                Export to Word
              </Button>
              <Button
                variant="subtle"
                color="red"
                size="xs"
                leftSection={<IconTrash size={16} />}
                onClick={handleClear}
              >
                Clear questionnaire
              </Button>
            </Group>
          </Group>
          <Accordion variant="separated">
            {results.map((item, i) => (
              <Accordion.Item key={`${i}-${item.question.slice(0, 40)}`} value={`q-${i}`}>
                <Accordion.Control>
                  <Text fw={500} lineClamp={2}>{item.question}</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <div>
                      <Group justify="space-between" mb="xs">
                        <Text size="xs" c="dimmed">Draft answer</Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconCopy size={14} />}
                          onClick={() => handleCopy(item, i)}
                        >
                          {copiedId === i ? 'Copied!' : 'Copy answer'}
                        </Button>
                      </Group>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{item.answer}</Text>
                    </div>
                    {item.citations && item.citations.length > 0 && (
                      <div>
                        <Text size="xs" c="dimmed" mb="xs">Cited policy sections</Text>
                        {item.citations.map((c, j) => (
                          <CitationBlock key={j} c={c} />
                        ))}
                      </div>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Paper>
      )}

      {results.length === 0 && !loading && (
        <Text size="sm" c="dimmed">Paste questions above and click Generate. Results persist when you refresh or switch tabs.</Text>
      )}
    </Box>
  )
}
