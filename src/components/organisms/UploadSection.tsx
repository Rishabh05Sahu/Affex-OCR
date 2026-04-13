"use client";

import { useState } from "react";
import FileUpload from "../molecules/FileUpload";
import Button from "../atoms/Button";
import ResultTable from "./ResultTable";

export default function UploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      alert("Please upload a file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: {
          Authorization: "Bearer testtoken123",
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setResult(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="w-full max-w-3xl mx-auto bg-white text-black rounded-2xl shadow-lg p-6 space-y-6">
      
      {/* Title */}
      <div>
        <div className="bg-white text-black">
        <h1 className="text-2xl font-bold text-gray-900">
          Medical OCR
        </h1>
        </div>
        <p className="text-sm text-gray-500">
          Upload report → Extract structured data
        </p>
      </div>

      {/* Upload */}
      <FileUpload onFileSelect={setFile} />

      {/* Selected File */}
      {file && (
        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
          ✅ {file.name}
        </div>
      )}

      {/* Button */}
      <Button onClick={handleUpload} loading={loading}>
        Extract Data
      </Button>

      {/* Result */}
{result && <ResultTable data={result} />}
    </div>
  );
}