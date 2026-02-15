import Anthropic from '@anthropic-ai/sdk';
import { JobListing } from '../types';

export interface ModeDetectionResult {
  mode: 'builder' | 'leader';
  confidence: number; // 0-100
  reasoning: string;
}

/**
 * Agent that analyzes job descriptions to automatically determine
 * whether the role is better suited for 'builder' or 'leader' resume mode.
 */
export class ModeDetectorAgent {
  private anthropic: Anthropic;
  private model: string;

  constructor(claudeApiKey: string, model: string = 'claude-3-5-haiku-20241022') {
    this.anthropic = new Anthropic({
      apiKey: claudeApiKey,
    });
    // Use Haiku for fast, cost-effective mode detection
    this.model = model;
  }

  /**
   * Analyzes a job description and determines if it's more suited for builder or leader mode
   */
  async detectMode(job: JobListing): Promise<ModeDetectionResult> {
    const prompt = this.buildDetectionPrompt(job);

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const textContent = response.content.find(block => block.type === 'text');
      const responseText = textContent?.text || '';

      return this.parseResponse(responseText);
    } catch (error) {
      console.error('❌ Error detecting mode:', error);
      // Default to leader mode on error
      return {
        mode: 'leader',
        confidence: 50,
        reasoning: 'Error during detection, defaulting to leader mode'
      };
    }
  }

  private buildDetectionPrompt(job: JobListing): string {
    return `Analyze the following job posting and determine whether this role is more suited for a "builder" or "leader" resume approach.

Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}

Job Description:
${job.description}

DEFINITIONS:
- BUILDER mode: Emphasizes hands-on technical work, coding, implementation, and direct technical contributions.
  Key indicators: "build", "develop", "implement", "code", "ship", technical skills requirements, focus on individual contributions, technical problem-solving

- LEADER mode: Emphasizes management, team leadership, strategic impact, and cross-functional collaboration.
  Key indicators: "lead", "manage", "mentor", "strategy", "scale", team size mentions, organizational impact, process improvement

ANALYSIS CRITERIA:
1. Job title (IC/Senior Engineer vs Staff/Principal/Director/VP)
2. Responsibilities (hands-on coding vs team management)
3. Required skills (technical depth vs leadership abilities)
4. Success metrics (individual output vs team/org outcomes)
5. Team interaction (independent work vs leading/managing others)

Respond in JSON format:
{
  "mode": "builder" | "leader",
  "confidence": <0-100>,
  "reasoning": "<2-3 sentence explanation>"
}

IMPORTANT:
- Be decisive. Choose the mode that best fits the MAJORITY of the job requirements.
- Default to "builder" for IC roles (Software Engineer, Senior Engineer) unless strong leadership signals present
- Default to "leader" for management roles (Staff+, Engineering Manager, Director+)
- Confidence should reflect how clear the signal is (90+ for very clear, 60-80 for mixed signals)`;
  }

  private parseResponse(responseText: string): ModeDetectionResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate the response
      if (!['builder', 'leader'].includes(parsed.mode)) {
        throw new Error(`Invalid mode: ${parsed.mode}`);
      }

      return {
        mode: parsed.mode as 'builder' | 'leader',
        confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      console.error('❌ Error parsing mode detection response:', error);
      console.error('Response text:', responseText);

      // Fallback: simple keyword analysis
      return this.fallbackDetection(responseText);
    }
  }

  private fallbackDetection(text: string): ModeDetectionResult {
    const lowerText = text.toLowerCase();

    // Count builder vs leader keywords
    const builderKeywords = ['builder', 'build', 'code', 'implement', 'develop', 'technical', 'hands-on', 'ship'];
    const leaderKeywords = ['leader', 'manage', 'lead', 'mentor', 'strategy', 'team', 'scale', 'director'];

    let builderScore = 0;
    let leaderScore = 0;

    builderKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) builderScore++;
    });

    leaderKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) leaderScore++;
    });

    const mode = builderScore > leaderScore ? 'builder' : 'leader';
    const confidence = Math.min(60, Math.abs(builderScore - leaderScore) * 10 + 50);

    return {
      mode,
      confidence,
      reasoning: `Fallback detection based on keyword analysis (${builderScore} builder signals, ${leaderScore} leader signals)`
    };
  }
}
