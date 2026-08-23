// Owns login field state, validation, and authenticated form submission.
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Divider } from '../../../components/ui/Divider';
import { Input } from '../../../components/ui/Input';
import { Panel } from '../../../components/ui/Panel';
import { submitLogin, type AuthenticatedUser } from '../auth-api';

interface LoginFormProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
}

type LoginFormErrors = Partial<Record<'identifier' | 'password' | 'form', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function LoginForm({ onAuthenticated }: LoginFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle the form submission
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: LoginFormErrors = {};
    const normalizedIdentifier = identifier.trim();
    // Validate the identifier
    if (!normalizedIdentifier) {
      nextErrors.identifier = 'Email address or username is required';
    } else if (normalizedIdentifier.includes('@') && !EMAIL_PATTERN.test(normalizedIdentifier)) {
      nextErrors.identifier = 'Please enter a valid email address';
    } else if (
      !normalizedIdentifier.includes('@') &&
      !USERNAME_PATTERN.test(normalizedIdentifier.toLowerCase())
    ) {
      nextErrors.identifier = 'Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens';
    }

    // Validate the password
    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (password.length > 128) {
      nextErrors.password = 'Password must be at most 128 characters';
    }

    setErrors(nextErrors);

    // If there are errors, set the errors and return
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    // Set the submitting state to true
    setIsSubmitting(true);

    try {
      // Submit the login form
      const user = await submitLogin({
        identifier: normalizedIdentifier,
        password,
        rememberMe,
      });
      // call the onAuthenticated callback
      onAuthenticated(user);
    } catch (error) {
      setErrors({
        form: error instanceof Error
          ? error.message
          : 'Unable to sign in right now. Please try again.',
      });
      setIsSubmitting(false);
    }
  };

  // Return the login form
  return (
    <Panel
      sectionNumber="01"
      header="ACCOUNT ACCESS"
      footer={
        <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
          <span>ADMIN PORTAL</span>
          <span>PALE RECORDS</span>
        </div>
      }
      className="bg-white"
    >
      <div className="space-y-6">
        <div>
          <h2 className="font-mono text-base font-bold uppercase tracking-wider text-black">
            Sign in to continue
          </h2>
          <p className="text-xs text-neutral-600 mt-1">
            Sign in to continue to PALE Records.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Input
            label="EMAIL OR USERNAME"
            required
            type="text"
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setErrors((currentErrors) => ({
                ...currentErrors,
                identifier: undefined,
                form: undefined,
              }));
            }}
            placeholder="name@institution.edu or username"
            error={errors.identifier}
            isMonospace
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
          />

          <Input
            label="PASSWORD"
            required
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((currentErrors) => ({
                ...currentErrors,
                password: undefined,
                form: undefined,
              }));
            }}
            placeholder="Enter your password"
            error={errors.password}
            isMonospace
            allowPasswordToggle
            autoComplete="current-password"
            maxLength={128}
          />

          <div className="pt-1">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onChange={setRememberMe}
              label="Remember me"
              size="sm"
            />
          </div>

          <Divider variant="hairline" spacing="sm" />

          {errors.form ? (
            <p role="alert" className="border border-signal-red bg-paper-light px-3 py-2 text-sm text-signal-red">
              {errors.form}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting}>
            {isSubmitting ? 'SIGNING IN' : 'SIGN IN →'}
          </Button>
        </form>
      </div>
    </Panel>
  );
}
