"use client";

import { useState } from "react";

interface DatePickerProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  required?: boolean;
}

export function DatePicker({
  name,
  defaultValue,
  value,
  onChange,
  className = "",
  required = false
}: DatePickerProps) {
  const [dateValue, setDateValue] = useState(value || defaultValue || "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDateValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <input
        type="date"
        name={name}
        value={value !== undefined ? value : dateValue}
        onChange={handleChange}
        required={required}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-zinc-400 cursor-pointer"
      />
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

export default DatePicker;
