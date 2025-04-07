import { TaskDetector } from './types';
import { RuleBasedTaskDetector } from './ruleBasedDetector';
// Import OpenAI detector when available
// import { OpenAITaskDetector } from './openAIDetector';

type DetectorType = 'rule-based' | 'openai';

export class TaskDetectorFactory {
  private static ruleBasedInstance: TaskDetector | null = null;
  private static openAIInstance: TaskDetector | null = null;
  private static skillsList: string[] = [];
  
  // Set available skills
  static setSkills(skills: string[]) {
    this.skillsList = skills;
    // Reset instances to rebuild with new skills
    this.ruleBasedInstance = null;
    this.openAIInstance = null;
  }
  
  // Get the preferred detector
  static getDetector(type: DetectorType = 'rule-based'): TaskDetector {
    switch (type) {
      case 'rule-based':
        if (!this.ruleBasedInstance) {
          this.ruleBasedInstance = new RuleBasedTaskDetector(this.skillsList);
        }
        return this.ruleBasedInstance;
        
      case 'openai':
        // For now, return rule-based since OpenAI isn't implemented yet
        console.log('OpenAI detector requested but not implemented; using rule-based');
        return this.getDetector('rule-based');
        
      default:
        return this.getDetector('rule-based');
    }
  }
}