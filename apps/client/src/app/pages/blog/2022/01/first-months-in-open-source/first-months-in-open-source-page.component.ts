import { paths } from '@ghostfolio/common/paths';

import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@Component({
  host: { class: 'page' },
  imports: [MatButtonModule, RouterModule],
  selector: 'gf-first-months-in-open-source-page',
  templateUrl: './first-months-in-open-source-page.html'
})
export class FirstMonthsInOpenSourcePageComponent {
  public routerLinkBlog = ['/' + paths.blog];
  public routerLinkPricing = ['/' + paths.pricing];
}
