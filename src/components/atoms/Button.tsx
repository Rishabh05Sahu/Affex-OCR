type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
};

export default function Button({ children, onClick, loading }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full py-2 px-4 rounded-lg bg-black text-white font-medium 
      hover:bg-gray-800 transition-all duration-200 disabled:opacity-50"
    >
      {loading ? "Processing..." : children}
    </button>
  );
}