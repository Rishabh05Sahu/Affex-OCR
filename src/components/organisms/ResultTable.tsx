"use client";

type Props = {
  data: any;
};

export default function ResultTable({ data }: Props) {
  if (!data?.sections) return null;

  return (
    <div className="space-y-8 text-black">
      {data.sections.map((section: any, index: number) => (
        <div key={index} className="bg-white border rounded-lg shadow-sm">
          
          {/* Section Header */}
          <div className="bg-gray-100 px-4 py-2 border-b">
            <h2 className="text-lg font-semibold">
              {section.name}
            </h2>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-3 text-left">Component</th>
                <th className="p-3 text-center">Value</th>
                <th className="p-3 text-center">Reference Range</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>

            <tbody>
              {section.observations.map((obs: any, i: number) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  
                  {/* Component */}
                  <td className="p-3 font-medium">
                    {obs.name}
                  </td>

                  {/* Value */}
                  <td className="p-3 text-center">
                    {obs.value} {obs.unit}
                  </td>

                  {/* Range */}
                  <td className="p-3 text-center">
                    {obs.range}
                  </td>

                  {/* Status */}
                  <td
                    className={`p-3 text-center font-semibold ${
                      obs.status === "High"
                        ? "text-red-600"
                        : obs.status === "Low"
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {obs.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}