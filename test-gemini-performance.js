/**
 * GEMINI API PERFORMANCE TESTING SCRIPT
 * Tests current response times for sequential vs parallel API calls
 * 
 * Usage: node test-gemini-performance.js
 */

const GEMINI_API_KEY = 'AIzaSyDRcNY962Cpa8PTX1GITIWhp0D5MCDfIM0';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Simple test prompts
const TEST_PROMPTS = [
  {
    type: 'lifePathMeaning',
    prompt: 'You are MAYA, a mystical numerologist. Explain Life Path Number 5 for John. Focus on independence, adventure, and freedom seeking. Keep response concise (200-300 words).'
  },
  {
    type: 'destinyMeaning',
    prompt: 'You are MAYA, a mystical numerologist. Explain Destiny Number 5 for John. Focus on life mission and transformative change. Keep response concise (200-300 words).'
  },
  {
    type: 'soulUrgeMeaning',
    prompt: 'You are MAYA, a mystical numerologist. Explain Soul Urge Number 5 for John. Focus on core desires and freedom. Keep response concise (200-300 words).'
  }
];

/**
 * Make single Gemini API call with timing
 */
async function callGeminiAPI(prompt, promptType) {
  const startTime = performance.now();
  const requestStartTime = Date.now();
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.8,
          }
        })
      }
    );

    const responseTime = performance.now() - startTime;
    const requestEndTime = Date.now();
    const totalTime = requestEndTime - requestStartTime;

    if (!response.ok) {
      const error = await response.text();
      return {
        type: promptType,
        success: false,
        error: error.substring(0, 100),
        responseTime: responseTime,
        totalTime: totalTime
      };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const endTime = performance.now();
    const totalEndTime = Date.now();

    return {
      type: promptType,
      success: true,
      responseTime: responseTime,
      totalTime: totalEndTime - requestStartTime,
      textLength: text.length,
      text: text.substring(0, 150) + '...'
    };
  } catch (error) {
    const errorTime = performance.now() - startTime;
    return {
      type: promptType,
      success: false,
      error: error.message,
      responseTime: errorTime,
      totalTime: errorTime
    };
  }
}

/**
 * Test SEQUENTIAL calls (current approach)
 */
async function testSequential() {
  console.log('\n' + '='.repeat(80));
  console.log('SEQUENTIAL CALLS TEST (Current Approach)');
  console.log('='.repeat(80));
  
  const overallStart = performance.now();
  const results = [];

  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    const prompt = TEST_PROMPTS[i];
    console.log(`\n[${i + 1}/${TEST_PROMPTS.length}] Calling ${prompt.type}...`);
    
    const result = await callGeminiAPI(prompt.prompt, prompt.type);
    results.push(result);
    
    console.log(`   ✓ Response Time: ${result.responseTime.toFixed(2)}ms`);
    console.log(`   ✓ Total Time: ${result.totalTime.toFixed(2)}ms`);
    if (result.success) {
      console.log(`   ✓ Content Length: ${result.textLength} chars`);
    } else {
      console.log(`   ✗ Error: ${result.error}`);
    }
  }

  const overallTime = performance.now() - overallStart;
  
  console.log('\n' + '-'.repeat(80));
  console.log('SEQUENTIAL RESULTS SUMMARY:');
  console.log('-'.repeat(80));
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.type}: ${r.responseTime.toFixed(2)}ms`);
  });
  const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
  console.log(`\nTotal Response Time: ${totalResponseTime.toFixed(2)}ms`);
  console.log(`Total Elapsed Time: ${overallTime.toFixed(2)}ms`);

  return { type: 'sequential', overall: overallTime, results };
}

/**
 * Test PARALLEL calls (new approach - all at once)
 */
async function testParallel() {
  console.log('\n' + '='.repeat(80));
  console.log('PARALLEL CALLS TEST (All At Once)');
  console.log('='.repeat(80));
  
  const overallStart = performance.now();
  console.log('\nCalling all 3 APIs in parallel...');
  
  const promises = TEST_PROMPTS.map(prompt => 
    callGeminiAPI(prompt.prompt, prompt.type)
  );

  const results = await Promise.all(promises);
  const overallTime = performance.now() - overallStart;

  console.log('\n' + '-'.repeat(80));
  console.log('PARALLEL RESULTS SUMMARY:');
  console.log('-'.repeat(80));
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.type}: ${r.responseTime.toFixed(2)}ms`);
  });
  const maxResponseTime = Math.max(...results.map(r => r.responseTime));
  console.log(`\nMax Response Time: ${maxResponseTime.toFixed(2)}ms (limiting factor)`);
  console.log(`Total Elapsed Time: ${overallTime.toFixed(2)}ms`);

  return { type: 'parallel', overall: overallTime, results };
}

/**
 * Test BATCHED calls (new approach - 1 first, then 2 parallel, then ...) 
 */
async function testBatched() {
  console.log('\n' + '='.repeat(80));
  console.log('BATCHED PARALLEL CALLS TEST (1 + 2 Parallel)');
  console.log('='.repeat(80));
  
  const overallStart = performance.now();
  const allResults = [];

  // First call
  console.log('\n[BATCH 1/2] Calling first API...');
  const result1 = await callGeminiAPI(TEST_PROMPTS[0].prompt, TEST_PROMPTS[0].type);
  allResults.push(result1);
  console.log(`   ✓ Response Time: ${result1.responseTime.toFixed(2)}ms`);

  // Parallel calls for remaining
  console.log('\n[BATCH 2/2] Calling remaining 2 APIs in parallel...');
  const promises = [
    callGeminiAPI(TEST_PROMPTS[1].prompt, TEST_PROMPTS[1].type),
    callGeminiAPI(TEST_PROMPTS[2].prompt, TEST_PROMPTS[2].type)
  ];

  const remainingResults = await Promise.all(promises);
  allResults.push(...remainingResults);

  const overallTime = performance.now() - overallStart;

  console.log('\n' + '-'.repeat(80));
  console.log('BATCHED PARALLEL RESULTS SUMMARY:');
  console.log('-'.repeat(80));
  allResults.forEach((r, i) => {
    console.log(`${i + 1}. ${r.type}: ${r.responseTime.toFixed(2)}ms`);
  });
  console.log(`\nTotal Elapsed Time: ${overallTime.toFixed(2)}ms`);

  return { type: 'batched', overall: overallTime, results: allResults };
}

/**
 * Run all tests and compare
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(15) + 'GEMINI API PERFORMANCE TESTING' + ' '.repeat(33) + '║');
  console.log('║' + ' '.repeat(10) + 'Testing Sequential vs Parallel vs Batched Calls' + ' '.repeat(21) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  console.log(`\nAPI Key: ${GEMINI_API_KEY.substring(0, 20)}...`);
  console.log(`Model: ${GEMINI_MODEL}`);
  console.log(`Test Prompts: ${TEST_PROMPTS.length}`);
  console.log(`Prompt Types: ${TEST_PROMPTS.map(p => p.type).join(', ')}`);

  const testResults = [];

  // Test 1: Sequential
  const seqResult = await testSequential();
  testResults.push(seqResult);

  // Small delay between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Parallel
  const parResult = await testParallel();
  testResults.push(parResult);

  // Small delay between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Batched
  const batchResult = await testBatched();
  testResults.push(batchResult);

  // Final comparison
  console.log('\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'FINAL COMPARISON' + ' '.repeat(42) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');

  const sorted = testResults.sort((a, b) => a.overall - b.overall);

  sorted.forEach((result, index) => {
    const speed = result.type === sorted[0].type ? '🟢 FASTEST' : '🔴 SLOWER';
    console.log(`${speed} | ${result.type.toUpperCase().padEnd(20)} | Total: ${result.overall.toFixed(2)}ms`);
  });

  const improvement = ((seqResult.overall - parResult.overall) / seqResult.overall * 100).toFixed(1);
  console.log(`\n⚡ Parallel is ${improvement}% faster than Sequential`);

  const batchImprovement = ((seqResult.overall - batchResult.overall) / seqResult.overall * 100).toFixed(1);
  console.log(`⚡ Batched is ${batchImprovement}% faster than Sequential`);

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80) + '\n');
}

// Run tests
runAllTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
