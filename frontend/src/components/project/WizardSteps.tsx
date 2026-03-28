import React from 'react';

export type WizardStep = {
  id: number;
  label: string;
  icon: string;
  status: 'completed' | 'current' | 'pending';
};

interface WizardStepsProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function WizardSteps({ steps, currentStep, onStepClick }: WizardStepsProps) {
  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step */}
            <button
              onClick={() => onStepClick?.(step.id)}
              disabled={step.status === 'pending' && step.id > currentStep + 1}
              className={`
                flex flex-col items-center gap-2 relative z-10
                ${step.status !== 'pending' || step.id <= currentStep + 1
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-50'
                }
              `}
            >
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold
                  transition-all duration-200
                  ${step.status === 'completed'
                    ? 'bg-success-500 text-white'
                    : step.status === 'current'
                    ? 'bg-primary-500 text-white ring-4 ring-primary-500/20'
                    : 'bg-light-divider dark:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary'
                  }
                `}
              >
                {step.status === 'completed' ? '✓' : step.icon}
              </div>
              <span
                className={`
                  text-sm font-medium
                  ${step.status === 'current'
                    ? 'text-primary-600 dark:text-primary-400'
                    : step.status === 'completed'
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-light-text-secondary dark:text-dark-text-secondary'
                  }
                `}
              >
                {step.label}
              </span>
            </button>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 -mt-6">
                <div
                  className={`
                    h-full transition-all duration-300
                    ${index < currentStep
                      ? 'bg-success-500'
                      : 'bg-light-divider dark:bg-dark-divider'
                    }
                  `}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export const wizardStepDefinitions: Omit<WizardStep, 'status'>[] = [
  { id: 0, label: '项目设置', icon: '1' },
  { id: 1, label: '角色管理', icon: '2' },
  { id: 2, label: '场景管理', icon: '3' },
  { id: 3, label: '分镜编辑', icon: '4' },
  { id: 4, label: '导出交付', icon: '5' },
];
