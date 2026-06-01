import ResumeUpload from '@/components/ResumeUpload';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
      <div className="text-center mb-10 space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
          Find Your Perfect Match
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload your resume and let our AI platform extract your core skills. 
          We'll automatically parse your PDF and match your profile with the right opportunities.
        </p>
      </div>

      <ResumeUpload />
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-center px-4">
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Upload PDF</h3>
          <p className="text-gray-500 text-sm">Simply drag and drop your standard resume PDF file.</p>
        </div>
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">AI Parsing</h3>
          <p className="text-gray-500 text-sm">Our system securely parses the text from your document.</p>
        </div>
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Skill Extraction</h3>
          <p className="text-gray-500 text-sm">We identify key technologies and frameworks instantly.</p>
        </div>
      </div>
    </div>
  );
}
