// Edits one recitation count with touch controls, direct entry, and connected validation.
import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { getRecitationCountLabel, isValidRecitationCount, MAX_RECITATION_COUNT } from '../recitation-draft';
import type { RecitationCount } from '../recitation-types';

interface RecitationCountControlProps {
  count: RecitationCount;
  studentName: string;
  dateLabel: string;
  disabled: boolean;
  onChange: (change: number | 'increment' | 'decrement') => void;
  onValidityChange: (isValid: boolean) => void;
}

export function RecitationCountControl({ count, studentName, dateLabel, disabled, onChange, onValidityChange }: RecitationCountControlProps) {
  const [error, setError] = useState('');
  const identity = `${studentName}, ${dateLabel}`;
  const changeCount = (change: number | 'increment' | 'decrement') => {
    setError('');
    onValidityChange(true);
    onChange(change);
  };

  return (
    <div className="w-full max-w-48" role="group" aria-label={`Recitation count for ${identity}`}>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-start">
        <Button
          size="icon" variant="outline" disabled={disabled || count === null || count === 0}
          aria-label={`Decrease recitations for ${identity}`}
          onClick={() => changeCount('decrement')}
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M5 12h14" /></svg>
        </Button>
        <Input
          type="text" inputMode="numeric" isMonospace size="lg"
          aria-label={`Recitations for ${identity}`}
          role={count === null ? undefined : 'spinbutton'}
          aria-valuemin={count === null ? undefined : 0}
          aria-valuemax={count === null ? undefined : MAX_RECITATION_COUNT}
          aria-valuenow={count === null ? undefined : count}
          aria-valuetext={count === null ? undefined : getRecitationCountLabel(count)}
          value={count === null || count === 0 ? '' : String(count)}
          disabled={disabled}
          error={error || undefined}
          className="h-11! px-1! text-center tabular-nums"
          onChange={(event) => {
            const value = event.target.value;
            const parsed = Number(value);
            if (/^\d*$/.test(value) && isValidRecitationCount(parsed)) {
              changeCount(parsed);
            } else {
              setError('Enter a whole number from 0 to 2,147,483,647.');
              onValidityChange(false);
            }
          }}
          onKeyDown={(event) => {
            if (count !== null && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
              event.preventDefault();
              changeCount(event.key === 'ArrowUp' ? 'increment' : 'decrement');
            }
          }}
        />
        <Button
          size="icon" variant="outline" disabled={disabled || count === null || count === MAX_RECITATION_COUNT}
          aria-label={`Increase recitations for ${identity}`}
          onClick={() => changeCount('increment')}
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M5 12h14M12 5v14" /></svg>
        </Button>
      </div>
      {count === null ? <p className="mt-2 text-xs leading-5 text-ink-secondary">Previous Check; count unknown. Enter the exact count.</p> : null}
      <Button variant="ghost" className="mt-1 h-11 w-full text-xs" disabled={disabled || (count === 0 && !error)} aria-label={`Clear recitations for ${identity}`} onClick={() => changeCount(0)}>
        Clear
      </Button>
    </div>
  );
}
