import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { UploadCloud, FileType, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../lib/api';

type Deck = {
  id: string;
  title: string;
};

export default function TeacherCardImportPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    apiClient.get<{ decks: Deck[] }>('/api/teacher/decks')
      .then(res => {
        if (res?.decks) {
          setDecks(res.decks);
          if (res.decks.length > 0) setSelectedDeck(res.decks[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedDeck) return;
    setStatus('uploading');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiClient.upload<{ message: string, added_count: number }>(
        `/api/teacher/decks/${selectedDeck}/import`, 
        formData
      );
      
      setAddedCount(response?.added_count || 0);
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Cards</h1>
        <p className="text-gray-500">Upload CSV or JSON files to bulk import flashcards into your decks.</p>
      </div>

      <Card title="File Upload" subtitle="Supported formats: .csv, .json (Expected fields: Front, Back)">
        <div className="space-y-4 mb-6">
          <label className="text-sm font-medium">Select Target Deck</label>
          <select 
            className="w-full p-2 border rounded-md bg-background"
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
          >
            {decks.map(deck => (
              <option key={deck.id} value={deck.id}>{deck.title}</option>
            ))}
          </select>
        </div>

        <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center space-y-4">
          <UploadCloud className="w-12 h-12 text-gray-400" />
          <div className="text-center">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-primary font-medium hover:underline">Click to upload</span>
              <span className="text-gray-500"> or drag and drop</span>
              <input id="file-upload" type="file" className="hidden" accept=".csv,.json" onChange={handleFileChange} />
            </label>
          </div>
          {file && (
            <div className="flex items-center space-x-2 text-sm bg-gray-50 p-2 rounded">
              <FileType className="w-4 h-4 text-blue-500" />
              <span>{file.name}</span>
              <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button disabled={!file || !selectedDeck || status === 'uploading'} onClick={handleUpload}>
            {status === 'uploading' ? 'Importing...' : 'Start Import'}
          </Button>
        </div>

        {status === 'success' && (
          <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            Successfully imported {addedCount} cards from {file?.name}.
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Failed to import. Please check your file format and try again.
          </div>
        )}
      </Card>
    </div>
  );
}
