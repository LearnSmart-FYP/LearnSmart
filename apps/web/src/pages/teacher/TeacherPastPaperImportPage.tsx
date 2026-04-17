import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FileText, Cpu, CheckSquare } from 'lucide-react';
import { apiClient } from '../../lib/api';

type ExtractedQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  options?: string[];
  suggested_answer?: string;
};

export default function TeacherPastPaperImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'review'>('idle');
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('processing');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await apiClient.upload<{ message: string, questions: ExtractedQuestion[] }>('/api/teacher/papers/extract', formData);
      if (res?.questions) {
        setQuestions(res.questions);
      }
      setStatus('review');
    } catch (e) {
      console.error(e);
      setStatus('idle');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Past Paper Import (AI)</h1>
        <p className="text-gray-500">Upload PDF or Word documents of past exams to automatically extract and categorise questions.</p>
      </div>

      {status === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>Drag and drop past papers to begin extraction</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-10">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-medium mb-2">Select a file to upload</h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
              Our AI will read the document, identify individual questions, extract multiple choice options, and suggest correct answers if a marking scheme is included.
            </p>
            
            <div className="mb-6">
              <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" className="border p-2 rounded-md" />
            </div>
            
            <Button onClick={handleUpload} disabled={!file}>Upload & Extract</Button>
          </CardContent>
        </Card>
      )}

      {status === 'processing' && (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Cpu className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
            <h3 className="text-xl font-medium mb-2">AI is processing your document...</h3>
            <p className="text-gray-500 mb-6">Extracting questions, identifying types, and tagging topics.</p>
            <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'review' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium flex items-center">
              <CheckSquare className="w-5 h-5 mr-2 text-green-500" />
              Review Extracted Questions ({questions.length} found)
            </h3>
            <div className="space-x-2">
              <Button variant="secondary" onClick={() => setStatus('idle')}>Discard All</Button>
              <Button onClick={() => setStatus('idle')}>Approve All to Question Bank</Button>
            </div>
          </div>
          
          {questions.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-4 flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">{q.question_type}</span>
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Difficulty: {q.difficulty}</span>
                  </div>
                  <p className="font-medium">{q.question_text}</p>
                  {q.options && q.options.length > 0 && (
                    <ul className="text-sm space-y-1 pl-4 list-disc">
                      {q.options.map((opt, i) => (
                        <li key={i} className={opt === q.suggested_answer ? "text-green-600 font-medium" : ""}>
                          {opt} {opt === q.suggested_answer && "(Suggested Answer)"}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.question_type === 'Essay' && q.suggested_answer && (
                    <div className="text-sm bg-gray-50 p-2 rounded text-gray-700">
                      <strong>Suggested Answer/Rubric:</strong> {q.suggested_answer}
                    </div>
                  )}
                </div>
                <div className="flex flex-col space-y-2">
                  <Button>Approve</Button>
                  <Button variant="secondary">Edit</Button>
                  <Button variant="ghost" className="text-red-500 hover:text-red-700">Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
