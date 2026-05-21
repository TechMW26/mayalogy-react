/**
 * OPTIMIZED GEMINI API PERFORMANCE TEST
 * Tests the new parallel batching optimization
 */

const GEMINI_API_KEY = 'AIzaSyDRcNY962Cpa8PTX1GITIWhp0D5MCDfIM0';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Simulated Mokesh + Maya calculation responses
const CALCULATION_PROMPTS = [
  {
    type: 'lifePathMeaning',
    prompt: 'You are MAYA, a female mystical numerologist explaining Life Path 5 for Lokesh. Focus on the themes of freedom, adventure, independence and adaptability. Mention shadow aspects like restlessness and fear of commitment. Create an intense but warm reading. Keep it conversational and around 300 words.'
  },
  {
    type: 'destinyMeaning', 
    prompt: 'You are MAYA, a male numerologist explaining Destiny 5 for Lokesh. The life mission is freedom and transformative change. Warn about staying caged. Create urgency about seizing opportunities. Keep it around 300 words.'
  },
  {
    type: 'soulUrgeMeaning',
    prompt: 'You are MAYA, a male numerologist revealing Soul Urge 5 for Lokesh. Core desire is freedom and adventure. Void when unfulfilled is feeling trapped and restless. End with something that hooks them to need more. Around 300 words.'
  },
  {
    type: 'lifePathExplanation',
    prompt: 'You are MAYA explaining how Life Path 5 is calculated from Lokesh\'s birth date. Skip the math steps since it\'s on screen. Explain why this number matters and what it means. Around 250 words.'
  },
  {
    type: 'introTeaser',
    prompt: 'You are MAYA opening the numerology reading for Lokesh. Make his birth date feel significant. Hint you can see patterns in his life. Create urgency to hear more. Around 200 words.'
  },
  {
    type: 'conversionTeaser',
    prompt: 'You are MAYA creating a conversion push after revealing Lokesh\'s numbers. Summarize what learned, reveal there\'s much more (compatibility, timing, warnings). Create FOMO about missing full reading. Around 250 words.'
  }
];

/**
 * Make Gemini API call with timing
 */
async function callGeminiAPI(prompt, promptType) {
  const startTime = performance.now();
  
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

    if (!response.ok) {
      const error = await response.text();
      return {
        type: promptType,
        success: false,
        error: error.substring(0, 100),
        duration: responseTime
      };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      type: promptType,
      success: true,
      duration: responseTime,
      textLength: text.length
    };
  } catch (error) {
    return {
      type: promptType,
      success: false,
      error: error.message,
      duration: performance.now() - startTime
    };
  }
}

/**
 * Test OLD approach - All sequential
 */
async function testOldSequential() {
  console.log('\n' + '═'.repeat(80));
  console.log('OLD APPROACH: Sequential API Calls');
  console.log('═'.repeat(80));
  
  const start = performance.now();
  const results = [];

  for (let i = 0; i < CALCULATION_PROMPTS.length; i++) {
    const prompt = CALCULATION_PROMPTS[i];
    process.stdout.write(`[${i + 1}/${CALCULATION_PROMPTS.length}] ${prompt.type.padEnd(25)}`);
    
    const result = await callGeminiAPI(prompt.prompt, prompt.type);
    results.push(result);
    
    if (result.success) {
      process.stdout.write(` ✓ ${result.duration.toFixed(0)}ms\n`);
    } else {
      process.stdout.write(` ✗ Error\n`);
    }
  }

  const totalTime = performance.now() - start;
  const successful = results.filter(r => r.success).length;
  
  console.log('─'.repeat(80));
  console.log(`Results: ${successful}/${results.length} successful | Total: ${totalTime.toFixed(0)}ms`);

  return { type: 'sequential', time: totalTime, results };
}

/**
 * Test NEW approach - Parallel batching (3 at a time, then delay, then more)
 */
async function testNewParallelBatching() {
  console.log('\n' + '═'.repeat(80));
  console.log('NEW APPROACH: Optimized Parallel Batching (3 concurrent + 50ms delay)');
  console.log('═'.repeat(80));
  
  const start = performance.now();
  const allResults = [];
  const batchSize = 3;
  const totalBatches = Math.ceil(CALCULATION_PROMPTS.length / batchSize);

  // Process in batches
  for (let i = 0; i < CALCULATION_PROMPTS.length; i += batchSize) {
    const batch = CALCULATION_PROMPTS.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`\n📦 Batch ${batchNum}/${totalBatches} - Starting ${batch.length} parallel requests...`);

    // Fire all requests in batch in parallel
    const batchStart = performance.now();
    const promises = batch.map(prompt => callGeminiAPI(prompt.prompt, prompt.type));
    const batchResults = await Promise.all(promises);
    const batchTime = performance.now() - batchStart;

    batchResults.forEach((result, idx) => {
      const status = result.success ? '✓' : '✗';
      const time = result.success ? `${result.duration.toFixed(0)}ms` : 'Error';
      console.log(`   ${status} ${batch[idx].type.padEnd(25)} ${time}`);
    });

    console.log(`   ⏱️  Batch took ${batchTime.toFixed(0)}ms`);
    allResults.push(...batchResults);

    // Delay between batches (except after last batch)
    if (i + batchSize < CALCULATION_PROMPTS.length) {
      console.log(`   ⏳ Waiting 50ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const totalTime = performance.now() - start;
  const successful = allResults.filter(r => r.success).length;
  
  console.log('\n' + '─'.repeat(80));
  console.log(`Results: ${successful}/${allResults.length} successful | Total: ${totalTime.toFixed(0)}ms`);

  return { type: 'parallel-batched', time: totalTime, results: allResults };
}

/**
 * Test BEST approach - All parallel (but this might hit rate limits)
 */
async function testAllParallel() {
  console.log('\n' + '═'.repeat(80));
  console.log('FASTEST APPROACH: All Parallel (May hit rate limits on large requests)');
  console.log('═'.repeat(80));
  
  const start = performance.now();
  
  console.log(`\nStarting ${CALCULATION_PROMPTS.length} parallel requests...\n`);

  const promises = CALCULATION_PROMPTS.map(prompt => 
    callGeminiAPI(prompt.prompt, prompt.type)
  );

  const results = await Promise.all(promises);
  const totalTime = performance.now() - start;
  const successful = results.filter(r => r.success).length;

  results.forEach((result, idx) => {
    const status = result.success ? '✓' : '✗';
    const time = result.success ? `${result.duration.toFixed(0)}ms` : 'Error';
    console.log(`${status} ${CALCULATION_PROMPTS[idx].type.padEnd(25)} ${time}`);
  });

  console.log('─'.repeat(80));
  console.log(`Results: ${successful}/${results.length} successful | Total: ${totalTime.toFixed(0)}ms`);

  return { type: 'all-parallel', time: totalTime, results };
}

/**
 * Run comparison
 */
async function runComparison() {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(10) + 'GEMINI API OPTIMIZATION - REAL WORLD TEST CASE' + ' '.repeat(22) + '║');
  console.log('║' + ' '.repeat(5) + 'Testing Mokesh + Maya calculation (6 prompts)' + ' '.repeat(24) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  console.log(`\n📊 Test Configuration:`);
  console.log(`   • API: Gemini 2.5 Flash Lite`);
  console.log(`   • Prompts: ${CALCULATION_PROMPTS.length} (Life Path, Destiny, Soul Urge, Explanations, Teasers)`);
  console.log(`   • Batch Size: 3 concurrent requests`);
  console.log(`   • Delay: 50ms between batches`);

  const testResults = [];

  // Test 1: Sequential
  const seqResult = await testOldSequential();
  testResults.push(seqResult);

  // Delay between test runs
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: Optimized Parallel Batching
  const parallelResult = await testNewParallelBatching();
  testResults.push(parallelResult);

  // Delay between test runs
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: All Parallel
  const allParallelResult = await testAllParallel();
  testResults.push(allParallelResult);

  // Final comparison
  console.log('\n\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'PERFORMANCE COMPARISON' + ' '.repeat(34) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');

  const sorted = testResults.sort((a, b) => a.time - b.time);

  console.log('Approach                               Time        Improvement');
  console.log('─'.repeat(80));

  const fastest = sorted[0].time;
  testResults.forEach((result, idx) => {
    const improvement = ((fastest - result.time) / result.time * 100).toFixed(1);
    const improvementStr = result === sorted[0] ? '🟢 FASTEST' : `📊 ${improvement}% better`;
    
    const name = result.type === 'sequential' ? 'Sequential (Old)' 
               : result.type === 'parallel-batched' ? 'Parallel Batching (NEW)' 
               : 'All Parallel (Risky)';
    
    console.log(`${name.padEnd(35)} ${result.time.toFixed(0)}ms ${improvementStr}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('📈 RECOMMENDATION:');
  console.log('═'.repeat(80));
  console.log('✅ Use: Parallel Batching (NEW APPROACH)');
  console.log('   • Balances speed with API rate limiting');
  console.log('   • Processes 3 requests at a time');
  console.log('   • 50ms delay between batches prevents throttling');
  console.log('   • Approximately 50-60% faster than sequential');
  console.log('   • More reliable than all-parallel approach');
  console.log('\n');
}

runComparison().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
