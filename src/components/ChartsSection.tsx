'use client';

import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  DoughnutController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  DoughnutController,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartsSectionProps {
  categories: {
    category: string;
    target: number;
    earned: number;
  }[];
  statusCounts: {
    completed: number;
    pending: number;
  };
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  categories,
  statusCounts,
}) => {
  const barCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const doughnutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barChartRef = useRef<ChartJS<'bar'> | null>(null);
  const doughnutChartRef = useRef<ChartJS<'doughnut'> | null>(null);

  useEffect(() => {
    if (!barCanvasRef.current) return;
    if (barChartRef.current) barChartRef.current.destroy();

    barChartRef.current = new ChartJS(barCanvasRef.current, {
      type: 'bar',
      data: {
        labels: categories.map((c) => c.category),
        datasets: [
          {
            label: 'Credits Earned',
            data: categories.map((c) => c.earned),
            backgroundColor: '#FF5A5F',
            borderColor: '#18181B',
            borderWidth: 2,
            borderRadius: 4,
          },
          {
            label: 'Credits Required',
            data: categories.map((c) => c.target),
            backgroundColor: '#FAF7F0',
            borderColor: '#18181B',
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 11, family: 'Space Grotesk', weight: 'bold' },
            },
          },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E4E4E7' } },
          x: { grid: { display: false } },
        },
      },
    });

    return () => {
      if (barChartRef.current) barChartRef.current.destroy();
    };
  }, [categories]);

  useEffect(() => {
    if (!doughnutCanvasRef.current) return;
    if (doughnutChartRef.current) doughnutChartRef.current.destroy();

    doughnutChartRef.current = new ChartJS(doughnutCanvasRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Not Started'],
        datasets: [
          {
            data: [statusCounts.completed, statusCounts.pending],
            backgroundColor: ['#10B981', '#FAF7F0'],
            borderWidth: 2,
            borderColor: '#18181B',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 11, family: 'Space Grotesk', weight: 'bold' },
            },
          },
        },
        cutout: '65%',
      },
    });

    return () => {
      if (doughnutChartRef.current) doughnutChartRef.current.destroy();
    };
  }, [statusCounts]);

  return (
    <div className="p-5 border-t-2 border-[#18181B] grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#FAF7F0]">
      <div className="bg-white p-4 rounded-lg border-2 border-[#18181B] shadow-brutal-sm space-y-2">
        <h4 className="text-xs font-heading font-extrabold uppercase text-[#18181B]">
          Credits Earned vs Target by Category
        </h4>
        <div className="h-60 relative">
          <canvas ref={barCanvasRef} />
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg border-2 border-[#18181B] shadow-brutal-sm space-y-2">
        <h4 className="text-xs font-heading font-extrabold uppercase text-[#18181B]">
          Course Completion Status
        </h4>
        <div className="h-60 relative flex items-center justify-center">
          <canvas ref={doughnutCanvasRef} />
        </div>
      </div>
    </div>
  );
};
