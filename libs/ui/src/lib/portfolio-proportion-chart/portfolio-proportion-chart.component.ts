import { getTooltipOptions } from '@ghostfolio/common/chart-helper';
import { UNKNOWN_KEY } from '@ghostfolio/common/config';
import { getLocale, getTextColor } from '@ghostfolio/common/helper';
import {
  AssetProfileIdentifier,
  PortfolioPosition
} from '@ghostfolio/common/interfaces';
import { ColorScheme } from '@ghostfolio/common/types';

import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { DataSource } from '@prisma/client';
import { Big } from 'big.js';
import { ChartConfiguration, Tooltip } from 'chart.js';
import { LinearScale } from 'chart.js';
import { ArcElement } from 'chart.js';
import { DoughnutController } from 'chart.js';
import { Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { isUUID } from 'class-validator';
import Color from 'color';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

import { translate } from '../i18n';

const {
  blue,
  cyan,
  grape,
  green,
  indigo,
  lime,
  orange,
  pink,
  red,
  teal,
  violet,
  yellow
} = require('open-color');

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgxSkeletonLoaderModule],
  selector: 'gf-portfolio-proportion-chart',
  styleUrls: ['./portfolio-proportion-chart.component.scss'],
  templateUrl: './portfolio-proportion-chart.component.html'
})
export class GfPortfolioProportionChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() baseCurrency: string;
  @Input() colorScheme: ColorScheme;
  @Input() cursor: string;
  @Input() data: {
    [symbol: string]: Pick<PortfolioPosition, 'type'> & {
      dataSource?: DataSource;
      name: string;
      value: number;
    };
  } = {};
  @Input() isInPercent = false;
  @Input() keys: string[] = [];
  @Input() locale = getLocale();
  @Input() maxItems?: number;
  @Input() showLabels = false;

  @Output() proportionChartClicked = new EventEmitter<AssetProfileIdentifier>();

  @ViewChild('chartCanvas') chartCanvas: ElementRef<HTMLCanvasElement>;

  public chart: Chart<'doughnut'>;
  public isLoading = true;

  private readonly OTHER_KEY = 'OTHER';

  private colorMap: {
    [symbol: string]: string;
  } = {};

  public constructor() {
    Chart.register(ArcElement, DoughnutController, LinearScale, Tooltip);
  }

  public ngAfterViewInit() {
    if (this.data) {
      this.initialize();
    }
  }

  public ngOnChanges() {
    if (this.data) {
      this.initialize();
    }
  }

  public ngOnDestroy() {
    this.chart?.destroy();
  }

  private initialize() {
    this.isLoading = true;
    const chartData: {
      [symbol: string]: {
        color?: string;
        name: string;
        subCategory?: { [symbol: string]: { value: Big } };
        value: Big;
      };
    } = {};
    this.colorMap = {
      [this.OTHER_KEY]: `rgba(${getTextColor(this.colorScheme)}, 0.24)`,
      [UNKNOWN_KEY]: `rgba(${getTextColor(this.colorScheme)}, 0.12)`
    };

    if (this.keys.length > 0) {
      Object.keys(this.data).forEach((symbol) => {
        if (this.data[symbol][this.keys[0]]?.toUpperCase()) {
          if (chartData[this.data[symbol][this.keys[0]].toUpperCase()]) {
            chartData[this.data[symbol][this.keys[0]].toUpperCase()].value =
              chartData[
                this.data[symbol][this.keys[0]].toUpperCase()
              ].value.plus(this.data[symbol].value || 0);

            if (
              chartData[this.data[symbol][this.keys[0]].toUpperCase()]
                .subCategory[this.data[symbol][this.keys[1]]]
            ) {
              chartData[
                this.data[symbol][this.keys[0]].toUpperCase()
              ].subCategory[this.data[symbol][this.keys[1]]].value = chartData[
                this.data[symbol][this.keys[0]].toUpperCase()
              ].subCategory[this.data[symbol][this.keys[1]]].value.plus(
                this.data[symbol].value || 0
              );
            } else {
              chartData[
                this.data[symbol][this.keys[0]].toUpperCase()
              ].subCategory[this.data[symbol][this.keys[1]] ?? UNKNOWN_KEY] = {
                value: new Big(this.data[symbol].value || 0)
              };
            }
          } else {
            chartData[this.data[symbol][this.keys[0]].toUpperCase()] = {
              name: this.data[symbol][this.keys[0]],
              subCategory: {},
              value: new Big(this.data[symbol].value || 0)
            };

            if (this.data[symbol][this.keys[1]]) {
              chartData[
                this.data[symbol][this.keys[0]].toUpperCase()
              ].subCategory = {
                [this.data[symbol][this.keys[1]]]: {
                  value: new Big(this.data[symbol].value || 0)
                }
              };
            }
          }
        } else {
          if (chartData[UNKNOWN_KEY]) {
            chartData[UNKNOWN_KEY].value = chartData[UNKNOWN_KEY].value.plus(
              this.data[symbol].value || 0
            );
          } else {
            chartData[UNKNOWN_KEY] = {
              name: this.data[symbol].name,
              subCategory: this.keys[1]
                ? { [this.keys[1]]: { value: new Big(0) } }
                : undefined,
              value: new Big(this.data[symbol].value || 0)
            };
          }
        }
      });
    } else {
      Object.keys(this.data).forEach((symbol) => {
        chartData[symbol] = {
          name: this.data[symbol].name,
          value: new Big(this.data[symbol].value || 0)
        };
      });
    }

    let chartDataSorted = Object.entries(chartData)
      .sort((a, b) => {
        return a[1].value.minus(b[1].value).toNumber();
      })
      .reverse();

    if (this.maxItems && chartDataSorted.length > this.maxItems) {
      // Add surplus items to OTHER group
      const rest = chartDataSorted.splice(
        this.maxItems,
        chartDataSorted.length - 1
      );

      chartDataSorted.push([
        this.OTHER_KEY,
        { name: this.OTHER_KEY, subCategory: {}, value: new Big(0) }
      ]);
      const otherItem = chartDataSorted[chartDataSorted.length - 1];

      rest.forEach((restItem) => {
        if (otherItem?.[1]) {
          otherItem[1] = {
            name: this.OTHER_KEY,
            subCategory: {},
            value: otherItem[1].value.plus(restItem[1].value)
          };
        }
      });

      // Sort data again
      chartDataSorted = chartDataSorted
        .sort((a, b) => {
          return a[1].value.minus(b[1].value).toNumber();
        })
        .reverse();
    }

    chartDataSorted.forEach(([symbol, item], index) => {
      if (this.colorMap[symbol]) {
        // Reuse color
        item.color = this.colorMap[symbol];
      } else {
        item.color =
          this.getColorPalette()[index % this.getColorPalette().length];
      }
    });

    const backgroundColorSubCategory: string[] = [];
    const dataSubCategory: number[] = [];
    const labelSubCategory: string[] = [];

    chartDataSorted.forEach(([, item]) => {
      let lightnessRatio = 0.2;

      Object.keys(item.subCategory ?? {}).forEach((subCategory) => {
        if (item.name === UNKNOWN_KEY) {
          backgroundColorSubCategory.push(item.color);
        } else {
          backgroundColorSubCategory.push(
            Color(item.color).lighten(lightnessRatio).hex()
          );
        }
        dataSubCategory.push(item.subCategory[subCategory].value.toNumber());
        labelSubCategory.push(subCategory);

        lightnessRatio += 0.1;
      });
    });

    const datasets: ChartConfiguration<'doughnut'>['data']['datasets'] = [
      {
        backgroundColor: chartDataSorted.map(([, item]) => {
          return item.color;
        }),
        borderWidth: 0,
        data: chartDataSorted.map(([, item]) => {
          return item.value.toNumber();
        })
      }
    ];

    let labels = chartDataSorted.map(([, { name }]) => {
      return name;
    });

    if (this.keys[1]) {
      datasets.unshift({
        backgroundColor: backgroundColorSubCategory,
        borderWidth: 0,
        data: dataSubCategory
      });

      labels = labelSubCategory.concat(labels);
    }

    if (datasets[0]?.data?.length === 0 || datasets[0]?.data?.[0] === 0) {
      labels = [''];
      datasets[0].backgroundColor = [this.colorMap[UNKNOWN_KEY]];
      datasets[0].data[0] = Number.MAX_SAFE_INTEGER;
    }

    if (datasets[1]?.data?.length === 0 || datasets[1]?.data?.[1] === 0) {
      labels = [''];
      datasets[1].backgroundColor = [this.colorMap[UNKNOWN_KEY]];
      datasets[1].data[1] = Number.MAX_SAFE_INTEGER;
    }

    const data: ChartConfiguration<'doughnut'>['data'] = {
      datasets,
      labels
    };

    if (this.chartCanvas) {
      if (this.chart) {
        this.chart.data = data;
        this.chart.options.plugins.tooltip = this.getTooltipPluginConfiguration(
          data
        ) as unknown;
        this.chart.update();
      } else {
        this.chart = new Chart<'doughnut'>(this.chartCanvas.nativeElement, {
          data,
          options: {
            animation: false,
            cutout: '70%',
            layout: {
              padding: this.showLabels === true ? 100 : 0
            },
            onClick: (event, activeElements) => {
              try {
                const dataIndex = activeElements[0].index;
                const symbol: string = event.chart.data.labels[dataIndex];

                const dataSource = this.data[symbol]?.dataSource;

                this.proportionChartClicked.emit({ dataSource, symbol });
              } catch {}
            },
            onHover: (event, chartElement) => {
              if (this.cursor) {
                event.native.target.style.cursor = chartElement[0]
                  ? this.cursor
                  : 'default';
              }
            },
            plugins: {
              datalabels: {
                color: (context) => {
                  return this.getColorPalette()[
                    context.dataIndex % this.getColorPalette().length
                  ];
                },
                display: this.showLabels === true ? 'auto' : false,
                labels: {
                  index: {
                    align: 'end',
                    anchor: 'end',
                    formatter: (value, context) => {
                      const symbol = context.chart.data.labels?.[
                        context.dataIndex
                      ] as string;

                      return value > 0
                        ? isUUID(symbol)
                          ? (translate(this.data[symbol]?.name) ?? symbol)
                          : symbol
                        : '';
                    },
                    offset: 8
                  }
                }
              },
              legend: { display: false },
              tooltip: this.getTooltipPluginConfiguration(data)
            }
          } as unknown,
          plugins: [ChartDataLabels],
          type: 'doughnut'
        });
      }
    }

    this.isLoading = false;
  }

  private getColorPalette() {
    return [
      blue[5],
      teal[5],
      lime[5],
      orange[5],
      pink[5],
      violet[5],
      indigo[5],
      cyan[5],
      green[5],
      yellow[5],
      red[5],
      grape[5]
    ];
  }

  private getTooltipPluginConfiguration(data: ChartConfiguration['data']) {
    return {
      ...getTooltipOptions({
        colorScheme: this.colorScheme,
        currency: this.baseCurrency,
        locale: this.locale
      }),
      callbacks: {
        label: (context) => {
          const labelIndex =
            (data.datasets[context.datasetIndex - 1]?.data?.length ?? 0) +
            context.dataIndex;
          let symbol = context.chart.data.labels?.[labelIndex] ?? '';

          if (symbol === this.OTHER_KEY) {
            symbol = $localize`Other`;
          } else if (symbol === UNKNOWN_KEY) {
            symbol = $localize`No data available`;
          }

          const name = translate(this.data[symbol as string]?.name);

          let sum = 0;
          for (const item of context.dataset.data) {
            sum += item;
          }

          const percentage = (context.parsed * 100) / sum;

          if ((context.raw as number) === Number.MAX_SAFE_INTEGER) {
            return $localize`No data available`;
          } else if (this.isInPercent) {
            return [`${name ?? symbol}`, `${percentage.toFixed(2)}%`];
          } else {
            const value = context.raw as number;
            return [
              `${name ?? symbol}`,
              `${value.toLocaleString(this.locale, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
              })} ${this.baseCurrency} (${percentage.toFixed(2)}%)`
            ];
          }
        },
        title: () => {
          return '';
        }
      }
    };
  }
}
