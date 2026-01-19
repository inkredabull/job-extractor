import { ClaudeBaseAgent } from './claude-base-agent';
import { JobListing } from '../types';
import { resolveFromProjectRoot } from '../utils/project-root';
import * as fs from 'fs';
import * as path from 'path';

export interface MetricsResult {
  success: boolean;
  jobId: string;
  metrics?: {
    ninetyDay: KPIMetric[];
    firstYear: KPIMetric[];
  };
  error?: string;
  timestamp: string;
}

export interface KPIMetric {
  category: string;
  metric: string;
  target: string;
  measurement: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export class MetricsAgent extends ClaudeBaseAgent {
  constructor(claudeApiKey: string, model?: string, maxTokens?: number) {
    super(claudeApiKey, model, maxTokens);
  }

  async extractMetrics(jobId: string): Promise<MetricsResult> {
    try {
      // Load job data
      const jobData = this.loadJobData(jobId);
      
      // Extract KPIs using Claude
      const metrics = await this.extractKPIs(jobData);
      
      // Log metrics to file
      this.logMetrics(jobId, metrics);
      
      // Console log metrics
      this.displayMetrics(metrics);
      
      return {
        success: true,
        jobId,
        metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };
    }
  }

  private loadJobData(jobId: string): JobListing {
    const jobDir = resolveFromProjectRoot('logs', jobId);
    
    if (!fs.existsSync(jobDir)) {
      throw new Error(`Job directory not found for ID: ${jobId}`);
    }
    
    const files = fs.readdirSync(jobDir);
    const jobFile = files.find(file => file.startsWith('job-') && file.endsWith('.json'));
    if (!jobFile) {
      throw new Error(`Job file not found for ID: ${jobId}`);
    }

    const jobPath = path.join(jobDir, jobFile);
    const jobData = fs.readFileSync(jobPath, 'utf-8');
    return JSON.parse(jobData);
  }

  private async extractKPIs(job: JobListing): Promise<{ ninetyDay: KPIMetric[]; firstYear: KPIMetric[] }> {
    const prompt = `You are an expert in engineering leadership and performance metrics. Analyze the following job posting and extract realistic, measurable KPIs that would be expected for the first 90 days and first year in this role.

Job Title: ${job.title}
Company: ${job.company}
Job Description: ${job.description}

Based on this job posting, identify:

1. **90-Day KPIs**: Metrics that would be realistic to achieve in the first 90 days (focusing on onboarding, team integration, process understanding, and quick wins)

2. **First Year KPIs**: Metrics that would be realistic to achieve in the first 12 months (focusing on strategic impact, team building, system improvements, and business outcomes)

For each KPI, provide:
- **Category**: The area this KPI belongs to (e.g., "Team Performance", "System Reliability", "Process Improvement", "Business Impact")
- **Metric**: The specific metric name
- **Target**: The specific, measurable target (with numbers/percentages where possible)
- **Measurement**: How this would be measured/tracked
- **Rationale**: Why this KPI is important for this role and timeline
- **Priority**: High, Medium, or Low based on likely importance to the role

Focus on:
- Engineering leadership metrics (team velocity, code quality, incident response)
- Technical metrics (system performance, reliability, scalability)
- Business metrics (delivery timelines, cost optimization, user satisfaction)
- People metrics (team growth, retention, collaboration)
- Process metrics (development velocity, deployment frequency, lead time)

Please respond in the following JSON format:
{
  "ninetyDay": [
    {
      "category": "Team Performance",
      "metric": "Team Velocity Baseline",
      "target": "Establish baseline sprint velocity for all teams",
      "measurement": "Story points completed per sprint across teams",
      "rationale": "Understanding current team capacity is essential for future planning and improvement",
      "priority": "high"
    }
  ],
  "firstYear": [
    {
      "category": "System Reliability",
      "metric": "System Uptime",
      "target": "Achieve 99.9% uptime",
      "measurement": "Monthly uptime percentage tracked via monitoring systems",
      "rationale": "Reliability is fundamental to user trust and business continuity",
      "priority": "high"
    }
  ]
}

Make the KPIs specific to the role level and company context. For senior roles, focus more on strategic and organizational metrics. For technical roles, emphasize system and code quality metrics.`;

    console.log('📊 Extracting KPIs for 90-day and first-year performance...');
    
    const response = await this.makeClaudeRequest(prompt);
    
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      if (!parsedResponse.ninetyDay || !parsedResponse.firstYear) {
        throw new Error('Invalid metrics format in response');
      }
      
      return {
        ninetyDay: parsedResponse.ninetyDay,
        firstYear: parsedResponse.firstYear
      };
    } catch (parseError) {
      console.warn('⚠️  Failed to parse metrics response, using fallback');
      // Return fallback metrics if parsing fails
      return {
        ninetyDay: [
          {
            category: "Team Integration",
            metric: "Team Assessment Complete",
            target: "Complete assessment of team capabilities and processes",
            measurement: "Documented team strengths, gaps, and improvement areas",
            rationale: "Understanding the team is essential for effective leadership",
            priority: "high" as const
          }
        ],
        firstYear: [
          {
            category: "Team Performance",
            metric: "Development Velocity",
            target: "Increase team velocity by 25%",
            measurement: "Story points or features delivered per sprint",
            rationale: "Improved velocity indicates better processes and team effectiveness",
            priority: "high" as const
          }
        ]
      };
    }
  }

  private logMetrics(jobId: string, metrics: { ninetyDay: KPIMetric[]; firstYear: KPIMetric[] }): void {
    try {
      const jobDir = resolveFromProjectRoot('logs', jobId);
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const metricsData = {
        timestamp: new Date().toISOString(),
        jobId,
        metrics,
        extractedAt: new Date().toISOString()
      };

      const metricsPath = path.join(jobDir, `metrics-${timestamp}.json`);
      fs.writeFileSync(metricsPath, JSON.stringify(metricsData, null, 2));
      console.log(`📝 Metrics logged to: ${metricsPath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to log metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private displayMetrics(metrics: { ninetyDay: KPIMetric[]; firstYear: KPIMetric[] }): void {
    console.log('\n📊 90-Day KPIs:');
    console.log('=' .repeat(50));
    
    metrics.ninetyDay.forEach((kpi, index) => {
      const priorityIcon = kpi.priority === 'high' ? '🔴' : 
                           kpi.priority === 'medium' ? '🟡' : '🟢';
      
      console.log(`\n${index + 1}. ${priorityIcon} ${kpi.category}: ${kpi.metric}`);
      console.log(`   Target: ${kpi.target}`);
      console.log(`   Measurement: ${kpi.measurement}`);
      console.log(`   Rationale: ${kpi.rationale}`);
    });
    
    console.log('\n📈 First Year KPIs:');
    console.log('=' .repeat(50));
    
    metrics.firstYear.forEach((kpi, index) => {
      const priorityIcon = kpi.priority === 'high' ? '🔴' : 
                           kpi.priority === 'medium' ? '🟡' : '🟢';
      
      console.log(`\n${index + 1}. ${priorityIcon} ${kpi.category}: ${kpi.metric}`);
      console.log(`   Target: ${kpi.target}`);
      console.log(`   Measurement: ${kpi.measurement}`);
      console.log(`   Rationale: ${kpi.rationale}`);
    });
    
    console.log('\n' + '=' .repeat(50));
  }

  async extract(): Promise<never> {
    throw new Error('MetricsAgent does not implement extract method. Use extractMetrics instead.');
  }

  async createResume(): Promise<never> {
    throw new Error('MetricsAgent does not implement createResume method. Use extractMetrics instead.');
  }
}