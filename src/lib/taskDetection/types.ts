export interface TaskDetectionResult {
    isTask: boolean;
    confidence: number; // 0-1 score
    taskText: string;
    suggestedSkills: string[];
    deadline?: string;
    priority?: 'low' | 'medium' | 'high';
    context?: string;
  }
  
  export interface TaskDetectorOptions {
    verbose?: boolean;
    confidenceThreshold?: number;
  }
  
  export interface TaskDetector {
    detectTask(text: string, options?: TaskDetectorOptions): Promise<TaskDetectionResult>;
  }