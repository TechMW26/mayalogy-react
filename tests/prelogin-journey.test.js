import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const funnelPath = new URL('../public/js/funnel.js', import.meta.url);
const onboardingPath = new URL('../public/js/onboarding.js', import.meta.url);
const numerologyPath = new URL('../public/js/numerology.js', import.meta.url);

test('pre-login journey limits questions and avoids manufactured certainty', async () => {
  const source = await readFile(funnelPath, 'utf8');
  const beginJourney = source.slice(source.indexOf('async beginJourney()'), source.indexOf('// ============================================================\n    //  PROGRESS METER'));

  assert.doesNotMatch(beginJourney, /getAdaptiveQuestionForStage\('q3_money'/);
  assert.doesNotMatch(beginJourney, /getAdaptiveQuestionForStage\('q4_relationship'/);
  assert.doesNotMatch(beginJourney, /showMiniCheck\(/);
  assert.match(source, /timedChartClaimsAllowed/);
  assert.match(source, /Keep CALCULATED facts, USER-STATED answers, and interpretation distinct/);
  assert.match(source, /Invented past events, diagnoses, and life incidents are forbidden/);
  assert.match(source, /Save your reading and continue/);
  assert.doesNotMatch(beginJourney, /shared what they see/);
});

test('onboarding keeps surname optional and validates a real non-future date', async () => {
  const source = await readFile(onboardingPath, 'utf8');
  assert.match(source, /Last name \(optional\)/);
  assert.match(source, /prefer_not_to_say/);
  assert.doesNotMatch(source, /Please enter your last name/);
  assert.match(source, /date\.getFullYear\(\) >= 1900/);
  assert.match(source, /date <= new Date\(\)/);
});

test('numerology uses normalized letters and rejects invalid inputs', async () => {
  const source = `${await readFile(numerologyPath, 'utf8')}\n;globalThis.__MayaNumerology = MayaNumerology;`;
  const context = {
    MAYA_CONFIG: {
      NUMEROLOGY: {
        PYTHAGOREAN_VALUES: Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, index) => [letter, (index % 9) + 1])),
        VOWELS: ['A', 'E', 'I', 'O', 'U'],
        MASTER_NUMBERS: [11, 22, 33],
      },
    },
    window: {
      MayaAstrology: {
        parseDate(value) {
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
          if (!match) return null;
          const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
          return date.getFullYear() === Number(match[1])
            && date.getMonth() === Number(match[2]) - 1
            && date.getDate() === Number(match[3]) ? date : null;
        },
      },
    },
  };
  context.MayaAstrology = context.window.MayaAstrology;
  vm.createContext(context);
  vm.runInContext(source, context);

  const calculator = context.__MayaNumerology;
  assert.equal(calculator.calculateDestinyNumber('José'), 4);
  assert.equal(calculator.calculateSoulUrge('José'), 11);
  assert.equal(calculator.calculateAll('José', '1990-01-01').lifePath, 3);
  assert.throws(() => calculator.calculateAll('', '1990-01-01'), /name spelling/i);
  assert.throws(() => calculator.calculateAll('José', '1990-02-31'), /valid birth date/i);
});
