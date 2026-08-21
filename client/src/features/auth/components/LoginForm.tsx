import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Divider } from '../../../components/ui/Divider';
import { Input } from '../../../components/ui/Input';
import { Panel } from '../../../components/ui/Panel';

type LoginFormErrors = Partial<Record<'email' | 'password', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<LoginFormErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: LoginFormErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextErrors.email = 'Email address is required';
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      nextErrors.password = 'Password is required';
    }

    setErrors(nextErrors);
  };

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
            label="EMAIL ADDRESS"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@institution.edu"
            error={errors.email}
            isMonospace
            autoComplete="email"
          />

          <Input
            label="PASSWORD"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            error={errors.password}
            isMonospace
            allowPasswordToggle
            autoComplete="current-password"
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

          <Button type="submit" variant="primary" size="lg" fullWidth>
            SIGN IN →
          </Button>
        </form>
      </div>
    </Panel>
  );
}
