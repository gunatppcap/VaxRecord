import { CheckCircleIcon, ExclamationCircleIcon, RefreshIcon } from './Icons';

interface StatusCardProps {
  title: string;
  status: 'ready' | 'loading' | 'error' | 'idle';
  value?: string | number | boolean;
  description?: string;
}

export function StatusCard({ title, status, value, description }: StatusCardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon className="icon status-ready" />;
      case 'loading':
        return <div className="loading-spinner" />;
      case 'error':
        return <ExclamationCircleIcon className="icon status-error" />;
      case 'idle':
        return <RefreshIcon className="icon status-idle" />;
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'ready':
        return 'status-ready';
      case 'loading':
        return 'status-loading';
      case 'error':
        return 'status-error';
      case 'idle':
        return 'status-idle';
    }
  };

  const formatValue = (val: any) => {
    if (typeof val === 'boolean') return val ? '是' : '否';
    if (val === undefined) return '未定义';
    if (val === null) return '空';
    return String(val);
  };

  return (
    <div className="status-card fade-in">
      <div className="status-header">
        {getStatusIcon()}
        <span className="status-title">{title}</span>
      </div>
      {value !== undefined && (
        <div className={`status-value ${getStatusClass()}`}>
          {formatValue(value)}
        </div>
      )}
      {description && (
        <div className="status-description">{description}</div>
      )}
    </div>
  );
}