import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Calendar, Users, Clock, CheckCircle } from 'lucide-react';
import { apiClient } from '../../lib/api';

type Assessment = { id: string; title: string; };
type ClassItem = { id: string; name: string; };
type Assignment = { id: string; assessment_id: string; class_id: string; title?: string; class_name?: string; start_time: string; end_time: string; };

export default function TeacherAssessmentAssignPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'idle' | 'assigning' | 'success' | 'error'>('idle');

  const loadData = async () => {
    try {
      const [assessRes, classRes] = await Promise.all([
        apiClient.get<{ assessments: Assessment[] }>('/api/teacher/assessments'),
        apiClient.get<{ classes: ClassItem[] }>('/api/classroom/teacher/classes')
      ]);
      if (assessRes?.assessments) {
        setAssessments(assessRes.assessments);
        if (assessRes.assessments.length > 0) setSelectedAssessment(assessRes.assessments[0].id);
      }
      if (classRes?.classes) {
        setClasses(classRes.classes);
        if (classRes.classes.length > 0) setSelectedClass(classRes.classes[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async () => {
    if (!selectedAssessment || !selectedClass || !startDate || !endDate) return;
    setStatus('assigning');
    try {
      await apiClient.post(`/api/teacher/assessments/${selectedAssessment}/assign`, {
        class_id: selectedClass,
        start_time: new Date(startDate).toISOString(),
        end_time: new Date(endDate).toISOString()
      });
      setStatus('success');
      // Briefly reset status
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Assign Assessment</h1>
        <p className="text-gray-500">Distribute your assessments to classes or specific students.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Assignment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Assessment</label>
              <select 
                className="w-full p-2 border rounded-md bg-background"
                value={selectedAssessment}
                onChange={(e) => setSelectedAssessment(e.target.value)}
              >
                {assessments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign To Class</label>
              <select 
                className="w-full p-2 border rounded-md bg-background"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <div className="flex items-center border rounded-md p-2 bg-background">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                  <input type="datetime-local" className="bg-transparent outline-none w-full text-sm" 
                    value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date (Due)</label>
                <div className="flex items-center border rounded-md p-2 bg-background">
                  <Clock className="w-4 h-4 mr-2 text-gray-500" />
                  <input type="datetime-local" className="bg-transparent outline-none w-full text-sm" 
                    value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full" 
              disabled={status === 'assigning' || !selectedAssessment || !selectedClass || !startDate || !endDate}
              onClick={handleAssign}
            >
              {status === 'assigning' ? 'Assigning...' : 'Confirm Assignment'}
            </Button>

            {status === 'success' && (
              <div className="p-3 bg-green-50 text-green-700 rounded-md flex items-center mt-4">
                <CheckCircle className="w-5 h-5 mr-2" />
                Assessment assigned successfully!
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Assignments (Mock UI)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-medium">Pop Quiz - Cell Division</h4>
                  <p className="text-xs text-gray-500 flex items-center mt-1">
                    <Users className="w-3 h-3 mr-1" /> Bio 101 - Section B
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    Active
                  </span>
                  <p className="text-xs text-gray-500 mt-1">Due in 2 days</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
