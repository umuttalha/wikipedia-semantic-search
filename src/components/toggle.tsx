import React from "react";
import { cn } from "@/lib/utils";

export const ToggleNew = ({
  className,
  label,
  textReranker,
  setTextReranker,
  onChange,
}: {
  className?: string;
  label?: string;
  textReranker?: boolean;
  setTextReranker: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
}) => {
  const handleToggle = () => {
    const newChecked = !textReranker;
    setTextReranker(newChecked);
    onChange?.(newChecked);
  };

  return (
    <span className="m-4">
      <span className="mr-3 mb-3 text-sm font-medium text-gray-900 dark:text-gray-300">
        {label}
      </span>

      <label className={cn("inline-flex items-center cursor-pointer", className)}>
        <input
          type="checkbox"
          checked={textReranker}
          onChange={handleToggle}
          className="sr-only peer"
        />
        <div
          className={cn(
            "relative w-11 h-6 mb-2 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"
          )}
        />
        
      </label>
      </span>
  );
};