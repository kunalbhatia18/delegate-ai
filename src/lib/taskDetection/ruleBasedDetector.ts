//src/lib/taskDetection/ruleBasedDetector.ts
import nlp from 'compromise';
// Try to load plugins but don't fail if they're not available
let datesPlugin: any = null;
let sentencesPlugin: any = null;
try {
  datesPlugin = require('compromise-dates');
  sentencesPlugin = require('compromise-sentences');
  
  // Extend compromise with plugins if available
  if (datesPlugin) nlp.extend(datesPlugin);
  if (sentencesPlugin) nlp.extend(sentencesPlugin);
} catch (e) {
  console.log('Warning: compromise plugins not available, using basic functionality');
}

import { TaskDetector, TaskDetectionResult, TaskDetectorOptions } from './types';

// Task patterns
const TASK_VERBS = [
  'do', 'make', 'create', 'write', 'prepare', 'update', 'review', 'check',
  'finish', 'complete', 'fix', 'implement', 'develop', 'design', 'build',
  'test', 'deploy', 'send', 'share', 'analyze', 'research', 'investigate'
];

const REQUEST_PATTERNS = [
  'can you', 'could you', 'would you', 'please', 'pls', 'need to', 'needs to',
  'should', 'must', 'have to', 'has to', 'required', 'want to', 'would like',
  'need someone', 'looking for someone'
];

const PRIORITY_INDICATORS = {
  high: ['urgent', 'asap', 'immediately', 'right away', 'high priority', 'important', 'critical'],
  medium: ['soon', 'when you can', 'this week', 'medium priority'],
  low: ['when you have time', 'no rush', 'low priority', 'whenever']
};

const DELEGATION_PATTERNS = [
  'assign', 'delegate', 'handle', 'take care of', 'own', 'be responsible for',
  'take ownership of', 'lead', 'drive', 'manage'
];

// Patterns that often indicate imperative sentences
const IMPERATIVE_PATTERNS = [
  'please', 'kindly', 'make sure', 'ensure', 'let\'s', 'let us', 
  'remember to', 'don\'t forget', 'help', 'consider'
];

export class RuleBasedTaskDetector implements TaskDetector {
  private skillsList: string[];

  constructor(skillsList: string[] = []) {
    this.skillsList = skillsList.map(s => s.toLowerCase());
  }

  async detectTask(
    text: string,
    options: TaskDetectorOptions = {}
  ): Promise<TaskDetectionResult> {
    const confidenceThreshold = options.confidenceThreshold || 0.4;
    const verbose = options.verbose || false;
    
    // Basic result structure
    const result: TaskDetectionResult = {
      isTask: false,
      confidence: 0,
      taskText: text,
      suggestedSkills: [],
      context: ''
    };
    
    // Process the text with compromise
    const doc = nlp(text);
    
    // Start analyzing the text
    let score = 0;
    
    // 1. Instead of using isImperative(), check for common imperative patterns
    const lowerText = text.toLowerCase();
    const imperative = IMPERATIVE_PATTERNS.some(pattern => 
      lowerText.includes(pattern.toLowerCase())
    );
    
    if (imperative) {
      score += 0.3;
      if (verbose) console.log('Detected likely imperative sentence');
    }
    
    // 2. Check for task verbs
    const taskVerbs = doc.match(`(${TASK_VERBS.join('|')})`);
    if (taskVerbs.found) {
      score += 0.2;
      if (verbose) console.log('Detected task verbs:', taskVerbs.text());
    }
    
    // 3. Check for request patterns
    const requestMatch = REQUEST_PATTERNS.some(pattern => 
      lowerText.includes(pattern.toLowerCase())
    );
    if (requestMatch) {
      score += 0.25;
      if (verbose) console.log('Detected request pattern');
    }
    
    // 4. Check for delegation language
    const delegationMatch = DELEGATION_PATTERNS.some(pattern => 
      lowerText.includes(pattern.toLowerCase())
    );
    if (delegationMatch) {
      score += 0.2;
      if (verbose) console.log('Detected delegation language');
    }
    
    // 5. Check for dates/deadlines - safely try to use the dates plugin
    let deadline = null;
    try {
    // Use type assertion to bypass TypeScript checking
    const docAny = doc as any;
    if (typeof docAny.dates === 'function') {
        const dates = docAny.dates();
        if (dates.found) {
        score += 0.15;
        deadline = dates.text();
        if (verbose) console.log('Detected date/deadline:', deadline);
        }
    }
    } catch (e) {
    // Fall back to regex for common date patterns
    const dateRegex = /(today|tomorrow|next week|this week|by (?:mon|tues|wednes|thurs|fri|satur|sun)day|by (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})/i;
    const match = text.match(dateRegex);
    if (match) {
        score += 0.15;
        deadline = match[0];
        if (verbose) console.log('Detected date/deadline via regex:', deadline);
    }
    }
    
    if (deadline) {
      result.deadline = deadline;
    }
    
    // 6. Check for priority indicators
    for (const [priority, indicators] of Object.entries(PRIORITY_INDICATORS)) {
      const match = indicators.some(indicator => 
        lowerText.includes(indicator.toLowerCase())
      );
      if (match) {
        score += 0.1;
        result.priority = priority as any;
        if (verbose) console.log(`Detected ${priority} priority`);
        break;
      }
    }
    
    // 7. Match skills from our list
    const matchedSkills = this.skillsList.filter(skill => 
      lowerText.includes(skill.toLowerCase())
    );
    
    if (matchedSkills.length > 0) {
      score += 0.1;
      result.suggestedSkills = matchedSkills;
      if (verbose) console.log('Matched skills:', matchedSkills);
    }
    
    // Cap confidence at 0.95
    result.confidence = Math.min(score, 0.95);
    result.isTask = result.confidence >= confidenceThreshold;
    
    // Extract context if possible
    try {
      // Try to use compromise to split sentences
      const sentences = doc.sentences().out('array') as string[];
      if (sentences.length > 1) {
        // First sentence is often the task, the rest is context
        result.taskText = sentences[0];
        result.context = sentences.slice(1).join(' ');
      }
    } catch (e) {
      // Fall back to simple period-based splitting
      const periodSplit = text.split('.');
      if (periodSplit.length > 1) {
        result.taskText = periodSplit[0].trim() + '.';
        result.context = periodSplit.slice(1).join('.').trim();
      }
    }
    
    if (verbose) {
      console.log('Task detection result:', {
        isTask: result.isTask,
        confidence: result.confidence,
        taskText: result.taskText,
        context: result.context,
        skills: result.suggestedSkills,
        deadline: result.deadline,
        priority: result.priority
      });
    }
    
    return result;
  }
}