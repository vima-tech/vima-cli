// @vima appointment-be
package demo;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/appointment")
public class AdminAppointmentController {
  @GetMapping("/list")
  public Object list() { return null; }

  @PostMapping("/audit")
  public Object audit() { return null; }
}
