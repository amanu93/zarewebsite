'use client';

export default function ContractGeneratorPage() {
  return (
    <iframe
      src="/contract-generator.html"
      title="Contract Generator"
      style={{
        width: '100%',
        height: 'calc(100vh - 60px)',
        border: 'none',
      }}
    />
  );
}
