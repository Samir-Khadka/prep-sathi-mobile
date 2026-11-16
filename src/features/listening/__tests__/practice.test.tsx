/**
 * Tests for the shared Listening / Reading practice helpers
 * (src/features/listening/practice.tsx): payload building,
 * answer counting, answer display, question fields and the
 * results view.
 */

import {fireEvent, render, screen} from '@testing-library/react-native';
import React from 'react';
import type {ContentQuestion} from '@/lib/scoring';
import {
  QuestionField,
  ResultsView,
  answeredCount,
  buildSubmitAnswers,
  displayAnswer,
  type PracticeOutcome,
} from '../practice';

const MCQ: ContentQuestion = {
  no: 31,
  type: 'mcq',
  prompt: 'What is the main idea of the lecture?',
  options: ['Sleep switches the brain off', 'Sleep organises learning'],
  answer: 1,
  explanation: 'The lecturer says the brain organises learning.',
  evidence: 'LECTURER: Sleep helps organise what we have learned.',
};

const SHORT: ContentQuestion = {
  no: 1,
  type: 'short',
  prompt: 'The class starts at ___',
  answers: ['half past nine', '9:30'],
  explanation: 'The receptionist says half past nine.',
  evidence: 'RECEPTIONIST: The class starts at half past nine.',
};

const TFNG: ContentQuestion = {
  no: 1,
  type: 'tfng',
  prompt: 'Surface currents are driven mainly by the wind.',
  answer: 'TRUE',
  explanation: 'The passage states it directly.',
  evidence: 'Surface currents are driven mainly by the wind.',
};

describe('buildSubmitAnswers', () => {
  it('drops unanswered questions and keeps answers as given', () => {
    expect(
      buildSubmitAnswers({1: 'half past nine', 2: '', 3: null, 4: 1, 5: undefined}),
    ).toEqual({1: 'half past nine', 4: 1});
  });
});

describe('answeredCount', () => {
  it('counts only questions with a real answer', () => {
    expect(answeredCount([MCQ, SHORT], {31: 1})).toBe(1);
    expect(answeredCount([MCQ, SHORT], {31: 1, 1: 'half past nine'})).toBe(2);
    expect(answeredCount([MCQ, SHORT], {1: ''})).toBe(0);
  });
});

describe('displayAnswer', () => {
  it('resolves an mcq index to its option text', () => {
    expect(displayAnswer(MCQ, 1)).toBe('Sleep organises learning');
    expect(displayAnswer(MCQ, 0)).toBe('Sleep switches the brain off');
  });

  it('passes tfng and short answers through', () => {
    expect(displayAnswer(TFNG, 'TRUE')).toBe('TRUE');
    expect(displayAnswer(SHORT, 'half past nine')).toBe('half past nine');
  });

  it('returns null for unanswered questions', () => {
    expect(displayAnswer(MCQ, null)).toBeNull();
    expect(displayAnswer(SHORT, '')).toBeNull();
    expect(displayAnswer(SHORT, undefined)).toBeNull();
  });
});

describe('QuestionField', () => {
  it('calls onChange with the option index for mcq', async () => {
    const onChange = jest.fn();
    await render(
      <QuestionField question={MCQ} value={null} onChange={onChange} />,
    );
    await fireEvent.press(screen.getByText('B. Sleep organises learning'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('offers TRUE / FALSE / NOT GIVEN for tfng', async () => {
    const onChange = jest.fn();
    await render(
      <QuestionField question={TFNG} value={null} onChange={onChange} />,
    );
    await fireEvent.press(screen.getByText('NOT GIVEN'));
    expect(onChange).toHaveBeenCalledWith('NOT GIVEN');
  });

  it('calls onChange with typed text for short answers', async () => {
    const onChange = jest.fn();
    await render(
      <QuestionField question={SHORT} value="" onChange={onChange} />,
    );
    await fireEvent.changeText(screen.getByTestId('answer-1'), 'half past nine');
    expect(onChange).toHaveBeenCalledWith('half past nine');
  });
});

describe('ResultsView', () => {
  it('shows the score, band, source note and per-question detail', async () => {
    const outcome: PracticeOutcome = {
      scoreRaw: 1,
      band: 5.0,
      results: [
        {
          no: 31,
          correct: true,
          yourAnswer: 1,
          correctAnswer: 'Sleep organises learning',
          explanation: 'The lecturer says so.',
          evidence: 'LECTURER: Sleep helps organise learning.',
        },
        {
          no: 1,
          correct: false,
          yourAnswer: null,
          correctAnswer: 'half past nine',
          explanation: 'The receptionist says half past nine.',
          evidence: 'RECEPTIONIST: The class starts at half past nine.',
        },
      ],
      source: 'local',
      durationSeconds: 600,
      queuedForSync: true,
    };
    await render(
      <ResultsView outcome={outcome} total={40} questions={[SHORT, MCQ]} />,
    );
    expect(screen.getByText('Score: 1 / 40')).toBeTruthy();
    expect(screen.getByTestId('results-band')).toBeTruthy();
    expect(screen.getByText(/Scored on this device/)).toBeTruthy();
    expect(screen.getByText('Question 31 — Correct')).toBeTruthy();
    expect(
      screen.getByText('Your answer: Sleep organises learning'),
    ).toBeTruthy();
    expect(screen.getByText('Question 1 — Not correct')).toBeTruthy();
    expect(screen.getByText('Your answer: Not answered')).toBeTruthy();
    expect(screen.getByText('Correct answer: half past nine')).toBeTruthy();
  });
});
