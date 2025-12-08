import { ExcelBlocker } from '@/components/ExcelBlocker';
import { Header } from '@/components/Header';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="py-8">
        <ExcelBlocker />
      </main>
    </div>
  );
};

export default Index;
