import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface PaymentStatusBadgeProps {
  status: 'Fully Paid' | 'Partially Paid' | 'Pending';
  size?: 'sm' | 'md' | 'lg';
}

export default function PaymentStatusBadge({ status, size = 'md' }: PaymentStatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'Fully Paid':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Partially Paid':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Pending':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getIcon = () => {
    const iconClass = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';
    switch (status) {
      case 'Fully Paid':
        return <CheckCircle className={iconClass} />;
      case 'Partially Paid':
        return <Clock className={iconClass} />;
      case 'Pending':
        return <AlertCircle className={iconClass} />;
    }
  };

  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';
  const padding = size === 'sm' ? 'px-2 py-0.5' : size === 'md' ? 'px-3 py-1' : 'px-4 py-2';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${padding} rounded-full border font-medium ${textSize} ${getStatusColor()}`}
    >
      {getIcon()}
      {status}
    </span>
  );
}
