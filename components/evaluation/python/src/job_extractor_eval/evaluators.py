#!/usr/bin/env python3
"""
Example LangSmith evaluation script for job extraction pipeline.

This script demonstrates how to use LangSmith to evaluate:
- Job extraction accuracy
- Required terms extraction quality  
- Overall pipeline performance

Usage:
    python examples/langsmith_evaluation.py
"""

import json
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

try:
    from langsmith import Client
    from langsmith.evaluation import evaluate
    LANGSMITH_AVAILABLE = True
except ImportError:
    LANGSMITH_AVAILABLE = False

def load_job_data(job_id: str) -> Dict[str, Any]:
    """Load job data from logs directory."""
    job_dir = f"logs/{job_id}"
    
    # Find most recent job JSON file
    import glob
    job_files = glob.glob(f"{job_dir}/job-*.json")
    if not job_files:
        raise FileNotFoundError(f"No job files found for {job_id}")
    
    latest_job_file = max(job_files)
    with open(latest_job_file, 'r') as f:
        return json.load(f)

def load_index_entry(job_id: str) -> Dict[str, Any]:
    """Load job entry from data/index.jsonl."""
    index_path = "data/index.jsonl"
    if not os.path.exists(index_path):
        raise FileNotFoundError("No index.jsonl found. Run extract-for-eval first.")
    
    with open(index_path, 'r') as f:
        for line in f:
            entry = json.loads(line.strip())
            if entry.get('job_id') == job_id:
                return entry
    
    raise ValueError(f"Job ID {job_id} not found in index")

def evaluate_required_terms_quality(job_id: str) -> Dict[str, Any]:
    """
    Evaluate the quality of extracted required terms.
    
    This is a simple example - in practice you'd have:
    - Ground truth datasets
    - More sophisticated metrics
    - Automated scoring functions
    """
    try:
        job_data = load_job_data(job_id)
        index_entry = load_index_entry(job_id)
        
        required_terms = index_entry.get('required_terms', [])
        description = job_data.get('description', '')
        
        # Simple quality metrics
        metrics = {
            'job_id': job_id,
            'terms_count': len(required_terms),
            'terms_coverage': len([term for term in required_terms if term.lower() in description.lower()]) / len(required_terms) if required_terms else 0,
            'avg_term_length': sum(len(term) for term in required_terms) / len(required_terms) if required_terms else 0,
            'has_technical_terms': any(term.lower() in ['python', 'react', 'typescript', 'aws', 'kubernetes'] for term in required_terms),
            'required_terms': required_terms[:5],  # Sample of terms for review
        }
        
        return metrics
        
    except Exception as e:
        return {'job_id': job_id, 'error': str(e)}

def evaluate_extraction_completeness(job_id: str) -> Dict[str, Any]:
    """Evaluate if all required fields were extracted."""
    try:
        job_data = load_job_data(job_id)
        
        required_fields = ['title', 'company', 'location', 'description']
        optional_fields = ['salary']
        
        completeness = {
            'job_id': job_id,
            'required_fields_present': sum(1 for field in required_fields if job_data.get(field)),
            'required_fields_total': len(required_fields),
            'completeness_score': sum(1 for field in required_fields if job_data.get(field)) / len(required_fields),
            'has_salary': bool(job_data.get('salary')),
            'description_length': len(job_data.get('description', '')),
        }
        
        return completeness
        
    except Exception as e:
        return {'job_id': job_id, 'error': str(e)}

def check_langsmith_setup():
    """Check if LangSmith is properly configured."""
    if not LANGSMITH_AVAILABLE:
        print("⚠️  LangSmith not available. Install with: pip install langsmith")
        return False
    
    api_key = os.getenv("LANGSMITH_API_KEY")
    if not api_key:
        print("⚠️  LANGSMITH_API_KEY not found in environment variables")
        print("   Add LANGSMITH_API_KEY=your_api_key to your .env file")
        return False
    
    try:
        client = Client(api_key=api_key)
        # Test the connection
        client.list_datasets(limit=1)
        print("✅ LangSmith API connection successful!")
        return True
    except Exception as e:
        print(f"❌ LangSmith API connection failed: {e}")
        print("   Check your API key at https://smith.langchain.com/")
        return False

def main():
    """Run evaluation on available job data."""
    print("🔍 LangSmith Job Extraction Evaluation")
    print("=" * 50)
    
    # Check LangSmith setup
    langsmith_connected = check_langsmith_setup()
    print()
    
    # Check if we have job data to evaluate
    if not os.path.exists('data/index.jsonl'):
        print("❌ No index.jsonl found. Run 'npm run dev extract-for-eval' first.")
        return
    
    # Load all job IDs from index
    job_ids = []
    with open('data/index.jsonl', 'r') as f:
        for line in f:
            entry = json.loads(line.strip())
            job_ids.append(entry['job_id'])
    
    print(f"📊 Evaluating {len(job_ids)} jobs...")
    print()
    
    # Evaluate required terms quality
    print("🎯 Required Terms Quality Evaluation:")
    print("-" * 30)
    
    terms_results = []
    for job_id in job_ids:
        result = evaluate_required_terms_quality(job_id)
        terms_results.append(result)
        
        if 'error' not in result:
            print(f"Job {job_id}: {result['terms_count']} terms, "
                  f"{result['terms_coverage']:.1%} coverage, "
                  f"tech terms: {'✅' if result['has_technical_terms'] else '❌'}")
    
    print()
    
    # Evaluate extraction completeness
    print("📋 Extraction Completeness Evaluation:")
    print("-" * 30)
    
    completeness_results = []
    for job_id in job_ids:
        result = evaluate_extraction_completeness(job_id)
        completeness_results.append(result)
        
        if 'error' not in result:
            print(f"Job {job_id}: {result['completeness_score']:.1%} complete, "
                  f"salary: {'✅' if result['has_salary'] else '❌'}, "
                  f"desc: {result['description_length']} chars")
    
    # Summary statistics
    print()
    print("📈 Summary Statistics:")
    print("-" * 20)
    
    successful_terms = [r for r in terms_results if 'error' not in r]
    successful_completeness = [r for r in completeness_results if 'error' not in r]
    
    if successful_terms:
        avg_terms = sum(r['terms_count'] for r in successful_terms) / len(successful_terms)
        avg_coverage = sum(r['terms_coverage'] for r in successful_terms) / len(successful_terms)
        tech_terms_pct = sum(1 for r in successful_terms if r['has_technical_terms']) / len(successful_terms)
        
        print(f"Average terms per job: {avg_terms:.1f}")
        print(f"Average coverage: {avg_coverage:.1%}")
        print(f"Jobs with technical terms: {tech_terms_pct:.1%}")
    
    if successful_completeness:
        avg_completeness = sum(r['completeness_score'] for r in successful_completeness) / len(successful_completeness)
        salary_pct = sum(1 for r in successful_completeness if r['has_salary']) / len(successful_completeness)
        
        print(f"Average extraction completeness: {avg_completeness:.1%}")
        print(f"Jobs with salary data: {salary_pct:.1%}")
    
    print()
    print("💡 Next Steps:")
    if not langsmith_connected:
        print("- Set up LangSmith API key to enable cloud tracking and advanced features")
        print("  Get your API key from: https://smith.langchain.com/")
    else:
        print("- Create datasets in LangSmith for automated evaluation")
        print("- Set up automated evaluation runs for prompt improvements")
        print("- Configure alerts for quality thresholds")
    print("- Create ground truth datasets for more accurate evaluation")
    print("- Add automated quality thresholds and alerts")
    print("- Implement A/B testing for prompt improvements")

if __name__ == "__main__":
    main()