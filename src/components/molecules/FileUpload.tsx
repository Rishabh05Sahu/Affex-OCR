"use client";

import { useRef, useState } from "react";

type Props = {
  onFileSelect: (file: File) => void;
};

export default function FileUpload({ onFileSelect }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-black transition-all rounded-xl p-8 bg-gray-50 text-center w-full"
    >
      {/* Hidden Input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        onChange={handleChange}
        className="hidden"
      />

      {!fileName ? (
        <div className="space-y-2">
          <p className="text-black font-semibold text-lg">
            Click to upload file
          </p>
          <p className="text-gray-500 text-sm">
            PDF, JPG, PNG supported
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* FILE NAME FIX */}
          <p className="text-green-600 font-medium max-w-full truncate">
             {fileName}
          </p>

          <p className="text-xs text-gray-500">
            Click to change file
          </p>
        </div>
      )}
    </div>
  );
}